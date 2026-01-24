import type { User } from "@saber2pr/types-github-api";

export async function getGithubId(username: string): Promise<number> {
  const response = await fetch(`https://api.github.com/users/${username}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub user: ${response.statusText}`);
  }
  const data = (await response.json()) as User;
  return data.id;
}
