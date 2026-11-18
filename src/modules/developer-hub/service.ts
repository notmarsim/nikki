import { and, asc, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  developerCategories,
  developerCommands,
  developerReferences,
  developerSnippets,
  githubConnections,
  notes,
  projectRepositories,
  projects,
} from "@/db/schema";
import { recordActivity } from "@/modules/activity/service";
import { validateExternalUrl } from "@/modules/bookmarks/ssrf";
import { getTagsMapForEntities, syncEntityTags } from "@/modules/relations/service";
import { decryptSecret, encryptSecret } from "./crypto";

export class DeveloperHubError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

// =============================================================================
// OVERVIEW & CATEGORIES
// =============================================================================

export async function getDeveloperHubOverview(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    const [
      snippetRows,
      commandRows,
      referenceRows,
      categoryRows,
      cheatsheetRows,
      internalDocRows,
      projectRows,
      githubRows,
      linkedRepoRows,
    ] = await Promise.all([
      tx
        .select()
        .from(developerSnippets)
        .where(
          and(
            eq(developerSnippets.userId, userId),
            eq(developerSnippets.workspaceId, workspaceId)
          )
        )
        .orderBy(desc(developerSnippets.updatedAt))
        .limit(100),
      tx
        .select()
        .from(developerCommands)
        .where(
          and(
            eq(developerCommands.userId, userId),
            eq(developerCommands.workspaceId, workspaceId)
          )
        )
        .orderBy(desc(developerCommands.updatedAt))
        .limit(100),
      tx
        .select()
        .from(developerReferences)
        .where(
          and(
            eq(developerReferences.userId, userId),
            eq(developerReferences.workspaceId, workspaceId)
          )
        )
        .orderBy(desc(developerReferences.updatedAt))
        .limit(100),
      tx
        .select()
        .from(developerCategories)
        .where(
          and(
            eq(developerCategories.userId, userId),
            eq(developerCategories.workspaceId, workspaceId)
          )
        )
        .orderBy(asc(developerCategories.sortOrder), asc(developerCategories.name)),
      tx
        .select({
          id: notes.id,
          title: notes.title,
          contentText: notes.contentText,
          docKind: notes.docKind,
          updatedAt: notes.updatedAt,
          projectId: notes.projectId,
        })
        .from(notes)
        .where(
          and(
            eq(notes.userId, userId),
            eq(notes.workspaceId, workspaceId),
            eq(notes.docKind, "cheatsheet"),
            isNull(notes.deletedAt)
          )
        )
        .orderBy(desc(notes.updatedAt))
        .limit(50),
      tx
        .select({
          id: notes.id,
          title: notes.title,
          contentText: notes.contentText,
          docKind: notes.docKind,
          updatedAt: notes.updatedAt,
          projectId: notes.projectId,
        })
        .from(notes)
        .where(
          and(
            eq(notes.userId, userId),
            eq(notes.workspaceId, workspaceId),
            eq(notes.docKind, "documentation"),
            isNull(notes.deletedAt)
          )
        )
        .orderBy(desc(notes.updatedAt))
        .limit(50),
      tx
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(and(eq(projects.userId, userId), eq(projects.workspaceId, workspaceId))),
      tx
        .select({
          id: githubConnections.id,
          accountLogin: githubConnections.accountLogin,
          avatarUrl: githubConnections.avatarUrl,
          scopes: githubConnections.scopes,
          updatedAt: githubConnections.updatedAt,
        })
        .from(githubConnections)
        .where(
          and(
            eq(githubConnections.userId, userId),
            eq(githubConnections.workspaceId, workspaceId)
          )
        )
        .limit(1),
      tx
        .select()
        .from(projectRepositories)
        .where(
          and(
            eq(projectRepositories.userId, userId),
            eq(projectRepositories.workspaceId, workspaceId)
          )
        )
        .orderBy(desc(projectRepositories.createdAt)),
    ]);

    const [snippetTags, commandTags] = await Promise.all([
      getTagsMapForEntities(
        userId,
        "snippet",
        snippetRows.map((s) => s.id)
      ),
      getTagsMapForEntities(
        userId,
        "command",
        commandRows.map((c) => c.id)
      ),
    ]);

    return {
      snippets: snippetRows.map((s) => ({ ...s, tags: snippetTags.get(s.id) ?? [] })),
      commands: commandRows.map((c) => ({ ...c, tags: commandTags.get(c.id) ?? [] })),
      references: referenceRows,
      categories: categoryRows,
      cheatsheets: cheatsheetRows,
      internalDocs: internalDocRows,
      projects: projectRows,
      githubConnection: githubRows[0] ?? null,
      linkedRepositories: linkedRepoRows,
    };
  });
}

export async function createCategory(
  userId: string,
  workspaceId: string,
  input: { name: string; description?: string | null }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(developerCategories)
      .values({
        userId,
        workspaceId,
        name: input.name,
        description: input.description ?? null,
      })
      .returning();
    return created!;
  });
}

export async function deleteCategory(userId: string, id: string) {
  return withUserRls(userId, async (tx) => {
    const deleted = await tx
      .delete(developerCategories)
      .where(
        and(eq(developerCategories.id, id), eq(developerCategories.userId, userId))
      )
      .returning({ id: developerCategories.id });
    if (deleted.length === 0) {
      throw new DeveloperHubError(404, "NOT_FOUND", "Category not found");
    }
    return deleted[0]!;
  });
}

// =============================================================================
// SNIPPETS
// =============================================================================

export async function createSnippet(
  userId: string,
  workspaceId: string,
  input: {
    title: string;
    description?: string | null;
    language: string;
    code: string;
    categoryId?: string | null;
    projectId?: string | null;
    sourceNoteId?: string | null;
    isFavorite?: boolean;
    tags?: string[];
  }
) {
  const created = await withUserRls(userId, async (tx) => {
    const [row] = await tx
      .insert(developerSnippets)
      .values({
        userId,
        workspaceId,
        title: input.title,
        description: input.description ?? null,
        language: input.language.toLowerCase(),
        code: input.code,
        categoryId: input.categoryId ?? null,
        projectId: input.projectId ?? null,
        sourceNoteId: input.sourceNoteId ?? null,
        isFavorite: input.isFavorite ?? false,
      })
      .returning();
    return row!;
  });

  const savedTags = input.tags
    ? await syncEntityTags(userId, workspaceId, "snippet", created.id, input.tags)
    : [];

  await recordActivity({
    userId,
    workspaceId,
    entityType: "snippet",
    entityId: created.id,
    action: "snippet.created",
    payload: { title: created.title, language: created.language },
  });

  return { ...created, tags: savedTags };
}

export async function updateSnippet(
  userId: string,
  workspaceId: string,
  snippetId: string,
  input: {
    title?: string;
    description?: string | null;
    language?: string;
    code?: string;
    categoryId?: string | null;
    projectId?: string | null;
    isFavorite?: boolean;
    tags?: string[];
  }
) {
  const updated = await withUserRls(userId, async (tx) => {
    const [row] = await tx
      .update(developerSnippets)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.language !== undefined ? { language: input.language.toLowerCase() } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(eq(developerSnippets.id, snippetId), eq(developerSnippets.userId, userId))
      )
      .returning();

    if (!row) {
      throw new DeveloperHubError(404, "NOT_FOUND", "Snippet not found");
    }
    return row;
  });

  const savedTags = input.tags
    ? await syncEntityTags(userId, workspaceId, "snippet", snippetId, input.tags)
    : (await getTagsMapForEntities(userId, "snippet", [snippetId])).get(snippetId) ?? [];

  return { ...updated, tags: savedTags };
}

export async function deleteSnippet(userId: string, snippetId: string) {
  return withUserRls(userId, async (tx) => {
    const deleted = await tx
      .delete(developerSnippets)
      .where(
        and(eq(developerSnippets.id, snippetId), eq(developerSnippets.userId, userId))
      )
      .returning({ id: developerSnippets.id });
    if (deleted.length === 0) {
      throw new DeveloperHubError(404, "NOT_FOUND", "Snippet not found");
    }
    return deleted[0]!;
  });
}

// =============================================================================
// COMMANDS
// =============================================================================

export async function createCommand(
  userId: string,
  workspaceId: string,
  input: {
    title: string;
    description?: string | null;
    command: string;
    platform: string;
    categoryId?: string | null;
    notes?: string | null;
    isFavorite?: boolean;
    tags?: string[];
  }
) {
  const created = await withUserRls(userId, async (tx) => {
    const [row] = await tx
      .insert(developerCommands)
      .values({
        userId,
        workspaceId,
        title: input.title,
        description: input.description ?? null,
        command: input.command,
        platform: input.platform.toLowerCase(),
        categoryId: input.categoryId ?? null,
        notes: input.notes ?? null,
        isFavorite: input.isFavorite ?? false,
      })
      .returning();
    return row!;
  });

  const savedTags = input.tags
    ? await syncEntityTags(userId, workspaceId, "command", created.id, input.tags)
    : [];

  await recordActivity({
    userId,
    workspaceId,
    entityType: "command",
    entityId: created.id,
    action: "command.created",
    payload: { title: created.title, platform: created.platform },
  });

  return { ...created, tags: savedTags };
}

export async function updateCommand(
  userId: string,
  workspaceId: string,
  commandId: string,
  input: {
    title?: string;
    description?: string | null;
    command?: string;
    platform?: string;
    categoryId?: string | null;
    notes?: string | null;
    isFavorite?: boolean;
    tags?: string[];
  }
) {
  const updated = await withUserRls(userId, async (tx) => {
    const [row] = await tx
      .update(developerCommands)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.command !== undefined ? { command: input.command } : {}),
        ...(input.platform !== undefined ? { platform: input.platform.toLowerCase() } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(eq(developerCommands.id, commandId), eq(developerCommands.userId, userId))
      )
      .returning();

    if (!row) {
      throw new DeveloperHubError(404, "NOT_FOUND", "Command not found");
    }
    return row;
  });

  const savedTags = input.tags
    ? await syncEntityTags(userId, workspaceId, "command", commandId, input.tags)
    : (await getTagsMapForEntities(userId, "command", [commandId])).get(commandId) ?? [];

  return { ...updated, tags: savedTags };
}

export async function deleteCommand(userId: string, commandId: string) {
  return withUserRls(userId, async (tx) => {
    const deleted = await tx
      .delete(developerCommands)
      .where(
        and(eq(developerCommands.id, commandId), eq(developerCommands.userId, userId))
      )
      .returning({ id: developerCommands.id });
    if (deleted.length === 0) {
      throw new DeveloperHubError(404, "NOT_FOUND", "Command not found");
    }
    return deleted[0]!;
  });
}

// =============================================================================
// EXTERNAL REFERENCES
// =============================================================================

export async function createReference(
  userId: string,
  workspaceId: string,
  input: {
    title: string;
    url: string;
    technology: string;
    versionLabel?: string | null;
    categoryId?: string | null;
    projectId?: string | null;
    description?: string | null;
  }
) {
  try {
    validateExternalUrl(input.url);
  } catch (err) {
    throw new DeveloperHubError(
      400,
      "INVALID_URL",
      err instanceof Error ? err.message : "Invalid reference URL"
    );
  }

  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(developerReferences)
      .values({
        userId,
        workspaceId,
        title: input.title,
        url: input.url,
        technology: input.technology,
        versionLabel: input.versionLabel ?? null,
        categoryId: input.categoryId ?? null,
        projectId: input.projectId ?? null,
        description: input.description ?? null,
      })
      .returning();
    return created!;
  });
}

export async function deleteReference(userId: string, referenceId: string) {
  return withUserRls(userId, async (tx) => {
    const deleted = await tx
      .delete(developerReferences)
      .where(
        and(
          eq(developerReferences.id, referenceId),
          eq(developerReferences.userId, userId)
        )
      )
      .returning({ id: developerReferences.id });
    if (deleted.length === 0) {
      throw new DeveloperHubError(404, "NOT_FOUND", "Reference not found");
    }
    return deleted[0]!;
  });
}

// =============================================================================
// GITHUB READ INTEGRATION (OPTIONAL, ENCRYPTED TOKEN, IN-MEMORY CACHE)
// =============================================================================

interface CacheEntry {
  expiresAt: number;
  data: unknown;
}
const githubCache = new Map<string, CacheEntry>();

async function githubFetchJson<T>(token: string, path: string): Promise<T> {
  const cacheKey = `${token.slice(-8)}:${path}`;
  const cached = githubCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }

  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Nikki-DevHub/1.0",
    },
    signal: AbortSignal.timeout(7000),
  });

  if (res.status === 401 || res.status === 403) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      throw new DeveloperHubError(
        429,
        "GITHUB_RATE_LIMITED",
        "GitHub API rate limit reached. Try again later."
      );
    }
    throw new DeveloperHubError(
      401,
      "GITHUB_AUTH_FAILED",
      "GitHub token is invalid, expired, or revoked."
    );
  }

  if (!res.ok) {
    throw new DeveloperHubError(
      502,
      "GITHUB_UPSTREAM_ERROR",
      `GitHub API returned status ${res.status}`
    );
  }

  const json = (await res.json()) as T;
  githubCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, data: json });
  return json;
}

export async function connectGithubPat(
  userId: string,
  workspaceId: string,
  token: string
) {
  let ghUser: { id: number; login: string; avatar_url?: string; name?: string };
  try {
    ghUser = await githubFetchJson(token, "/user");
  } catch (err) {
    if (err instanceof DeveloperHubError) throw err;
    throw new DeveloperHubError(502, "GITHUB_UNAVAILABLE", "Could not reach GitHub API");
  }

  const encryptedToken = encryptSecret(token);

  return withUserRls(userId, async (tx) => {
    const existing = await tx
      .select({ id: githubConnections.id })
      .from(githubConnections)
      .where(
        and(
          eq(githubConnections.userId, userId),
          eq(githubConnections.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (existing[0]) {
      const [updated] = await tx
        .update(githubConnections)
        .set({
          githubAccountId: String(ghUser.id),
          accountLogin: ghUser.login,
          avatarUrl: ghUser.avatar_url ?? null,
          encryptedToken,
          connectionMetadata: { name: ghUser.name ?? ghUser.login },
          updatedAt: new Date(),
        })
        .where(eq(githubConnections.id, existing[0].id))
        .returning({
          id: githubConnections.id,
          accountLogin: githubConnections.accountLogin,
          avatarUrl: githubConnections.avatarUrl,
          updatedAt: githubConnections.updatedAt,
        });
      return updated!;
    }

    const [created] = await tx
      .insert(githubConnections)
      .values({
        userId,
        workspaceId,
        githubAccountId: String(ghUser.id),
        accountLogin: ghUser.login,
        avatarUrl: ghUser.avatar_url ?? null,
        encryptedToken,
        scopes: "read",
        connectionMetadata: { name: ghUser.name ?? ghUser.login },
      })
      .returning({
        id: githubConnections.id,
        accountLogin: githubConnections.accountLogin,
        avatarUrl: githubConnections.avatarUrl,
        updatedAt: githubConnections.updatedAt,
      });

    return created!;
  });
}

export async function disconnectGithub(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    await tx
      .delete(githubConnections)
      .where(
        and(
          eq(githubConnections.userId, userId),
          eq(githubConnections.workspaceId, workspaceId)
        )
      );
    return { disconnected: true };
  });
}

async function getDecryptedToken(userId: string, workspaceId: string): Promise<string> {
  return withUserRls(userId, async (tx) => {
    const [row] = await tx
      .select({ encryptedToken: githubConnections.encryptedToken })
      .from(githubConnections)
      .where(
        and(
          eq(githubConnections.userId, userId),
          eq(githubConnections.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (!row) {
      throw new DeveloperHubError(
        404,
        "GITHUB_NOT_CONNECTED",
        "No GitHub account connected"
      );
    }
    return decryptSecret(row.encryptedToken);
  });
}

export async function listGithubRepositories(userId: string, workspaceId: string) {
  const token = await getDecryptedToken(userId, workspaceId);
  const repos = await githubFetchJson<
    Array<{
      id: number;
      full_name: string;
      name: string;
      description: string | null;
      private: boolean;
      html_url: string;
      language: string | null;
      default_branch: string;
      updated_at: string;
      stargazers_count: number;
      open_issues_count: number;
    }>
  >(token, "/user/repos?sort=updated&per_page=30");

  return repos.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    name: r.name,
    description: r.description,
    isPrivate: r.private,
    htmlUrl: r.html_url,
    language: r.language,
    defaultBranch: r.default_branch,
    updatedAt: r.updated_at,
    stars: r.stargazers_count,
    openIssues: r.open_issues_count,
  }));
}

export async function getGithubRepositoryDetails(
  userId: string,
  workspaceId: string,
  owner: string,
  repo: string
) {
  const token = await getDecryptedToken(userId, workspaceId);
  const safeOwner = encodeURIComponent(owner);
  const safeRepo = encodeURIComponent(repo);

  const [overview, issues, pulls, releases, commits] = await Promise.all([
    githubFetchJson<{
      full_name: string;
      description: string | null;
      html_url: string;
      language: string | null;
      default_branch: string;
      stargazers_count: number;
      forks_count: number;
      updated_at: string;
    }>(token, `/repos/${safeOwner}/${safeRepo}`),
    githubFetchJson<
      Array<{ id: number; number: number; title: string; state: string; html_url: string }>
    >(token, `/repos/${safeOwner}/${safeRepo}/issues?state=open&per_page=10`),
    githubFetchJson<
      Array<{ id: number; number: number; title: string; state: string; html_url: string }>
    >(token, `/repos/${safeOwner}/${safeRepo}/pulls?state=open&per_page=10`),
    githubFetchJson<
      Array<{ id: number; tag_name: string; name: string | null; html_url: string; published_at: string }>
    >(token, `/repos/${safeOwner}/${safeRepo}/releases?per_page=5`),
    githubFetchJson<
      Array<{
        sha: string;
        html_url: string;
        commit: { message: string; author: { name: string; date: string } };
      }>
    >(token, `/repos/${safeOwner}/${safeRepo}/commits?per_page=8`),
  ]);

  return {
    overview,
    issues: issues.filter((i) => !("pull_request" in i)),
    pulls,
    releases,
    commits: commits.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split("\n")[0] ?? "",
      author: c.commit.author.name,
      date: c.commit.author.date,
      url: c.html_url,
    })),
  };
}

export async function linkRepositoryToProject(
  userId: string,
  workspaceId: string,
  input: {
    projectId: string;
    repositoryIdentifier: string;
    repositoryUrl: string;
    defaultBranch?: string;
    language?: string | null;
    description?: string | null;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [proj] = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, input.projectId), eq(projects.userId, userId)))
      .limit(1);
    if (!proj) {
      throw new DeveloperHubError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    const [created] = await tx
      .insert(projectRepositories)
      .values({
        userId,
        workspaceId,
        projectId: input.projectId,
        repositoryIdentifier: input.repositoryIdentifier,
        repositoryUrl: input.repositoryUrl,
        defaultBranch: input.defaultBranch ?? "main",
        language: input.language ?? null,
        description: input.description ?? null,
      })
      .onConflictDoNothing()
      .returning();

    return created;
  });
}

export async function unlinkRepositoryFromProject(userId: string, linkId: string) {
  return withUserRls(userId, async (tx) => {
    const deleted = await tx
      .delete(projectRepositories)
      .where(
        and(eq(projectRepositories.id, linkId), eq(projectRepositories.userId, userId))
      )
      .returning({ id: projectRepositories.id });
    if (deleted.length === 0) {
      throw new DeveloperHubError(404, "NOT_FOUND", "Repository link not found");
    }
    return deleted[0]!;
  });
}

// Keep unused imports clean if needed
export { ilike, inArray, or };
