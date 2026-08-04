export interface FeedVisibilityPlan {
  visible: boolean[];
  newlyRevealedKeys: string[];
}

export function planFeedVisibility(
  postKeys: string[],
  previouslyRevealed: ReadonlySet<string>,
  allowance: number,
): FeedVisibilityPlan {
  const revealed = new Set(previouslyRevealed);
  const newlyRevealedKeys: string[] = [];
  let boundaryReached = false;
  const visible = postKeys.map((postKey) => {
    if (boundaryReached) return false;
    if (revealed.has(postKey)) return true;
    if (revealed.size >= allowance) {
      boundaryReached = true;
      return false;
    }
    revealed.add(postKey);
    newlyRevealedKeys.push(postKey);
    return true;
  });

  return { visible, newlyRevealedKeys };
}
