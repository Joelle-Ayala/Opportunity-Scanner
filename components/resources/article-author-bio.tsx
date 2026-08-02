import type { ResourceArticle } from "@/lib/marketingContent";
import { founderStory } from "@/lib/founderStory";

const researchTeamBio =
  "The Opportunity Scanner Research Team reviews official public records and translates them into practical public-sector revenue motions, buyer paths, and next actions. Every material finding should remain connected to its source and clearly distinguish live opportunities from historical evidence.";

export function ArticleAuthorBio({ article }: { article: ResourceArticle }) {
  if (!article.author) return null;

  const isFounder = article.author.id === founderStory.identity.schemaId;
  const bio = isFounder ? founderStory.bios.author : researchTeamBio;

  return (
    <aside aria-label="About the author" className="mt-10 border-y border-line py-6">
      <div className="grid gap-4 sm:grid-cols-[48px_1fr] sm:items-start">
        <div
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-md bg-ink text-sm font-semibold text-white"
        >
          {isFounder ? founderStory.identity.initials : "OS"}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-accent">About the author</p>
          <p className="mt-2 font-semibold text-ink">{article.author.name}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{bio}</p>
          {article.author.url ? (
            <a className="mt-3 inline-flex text-sm font-semibold text-accent hover:text-[#0A6871]" href={article.author.url} rel="author">
              {isFounder ? "About Joelle Ayala" : "How Opportunity Scanner works"}
            </a>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
