import { go } from "./ui";

/** open what a notification points at */
export const linkTo = (l?: string) => {
  if (!l) return;
  const [k, a, ...rest] = l.split(":");
  const b = rest.join(":");
  if (k === "chirp") go(`/feed/tag/${a}`);
  else if (k === "article") go(`/news/${a}`);
  else if (k === "lounge") go(`/lounge/${a}/${b}`);
  else if (k === "trade") go(`/trade/t/${a}/${b}`);
  else if (k === "wallet") go("/wallet/activity");
};
