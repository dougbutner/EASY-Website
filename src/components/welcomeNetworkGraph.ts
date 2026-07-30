import * as d3 from 'd3';
import { tetrahedralLevelFromScore, type EasyInviteAdopter } from '@/services/easyInvite';

export const NETWORK_ROOT_ID = '__welcome_network__';

export const WELCOME_LEVEL_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
] as const;

export type NetworkLayoutMode = 'force' | 'tangled' | 'radial' | 'pack' | 'horizontal';

export type WelcomeNetworkNode = {
  id: string;
  score: number;
  banked: string;
  invitedby: string;
  /** Tetrahedral multiplier level from invite score (matches Welcome Back pricing). */
  level: number;
  childCount: number;
  x: number;
  y: number;
};

export type WelcomeNetworkLink = {
  source: string;
  target: string;
};

export type WelcomeNetworkGraph = {
  nodes: WelcomeNetworkNode[];
  links: WelcomeNetworkLink[];
  hierarchyRoot: d3.HierarchyNode<HierarchyDatum>;
  memberCount: number;
  hierarchyMemberCount: number;
};

export type HierarchyDatum = {
  account: string;
  score: number;
  children?: HierarchyDatum[];
};

export function welcomeLevelColor(level: number): string {
  const lvl = Math.max(1, Math.floor(level));
  return WELCOME_LEVEL_COLORS[Math.min(lvl - 1, WELCOME_LEVEL_COLORS.length - 1)];
}

export function nodeRadius(n: WelcomeNetworkNode): number {
  return 5 + Math.min(8, Math.sqrt(n.childCount) * 1.8) + (n.level === 1 ? 2 : 0);
}

function buildChildrenMap(adopters: EasyInviteAdopter[]): {
  accounts: Set<string>;
  byAccount: Map<string, EasyInviteAdopter>;
  childrenByInviter: Map<string, string[]>;
} {
  const accounts = new Set(adopters.map((a) => a.account));
  const byAccount = new Map(adopters.map((a) => [a.account, a]));
  const childrenByInviter = new Map<string, string[]>();

  for (const a of adopters) {
    const inv = a.invitedby;
    if (!inv || !accounts.has(inv)) continue;
    if (!childrenByInviter.has(inv)) childrenByInviter.set(inv, []);
    childrenByInviter.get(inv)!.push(a.account);
  }

  for (const kids of childrenByInviter.values()) {
    kids.sort((a, b) => a.localeCompare(b));
  }

  return { accounts, byAccount, childrenByInviter };
}

/**
 * Spanning forest: each adopter appears exactly once. Direct invitees only; skips
 * back-edges when Welcome Back creates a loop (node already placed upstream).
 */
export function buildSpanningHierarchy(adopters: EasyInviteAdopter[]): d3.HierarchyNode<HierarchyDatum> {
  const { accounts, byAccount, childrenByInviter } = buildChildrenMap(adopters);
  const placed = new Set<string>();

  const buildSubtree = (account: string): HierarchyDatum => {
    const row = byAccount.get(account);
    if (!row) return { account, score: 0 };
    placed.add(account);

    const childIds = (childrenByInviter.get(account) ?? []).filter((id) => !placed.has(id));
    const children = childIds.map((id) => buildSubtree(id));

    return {
      account: row.account,
      score: row.score,
      ...(children.length ? { children } : {}),
    };
  };

  const rootRows = adopters
    .filter((a) => !a.invitedby || !accounts.has(a.invitedby))
    .sort((a, b) => a.account.localeCompare(b.account));

  for (const a of adopters) {
    if (!placed.has(a.account)) {
      rootRows.push(a);
    }
  }

  const uniqueRoots = [...new Map(rootRows.map((r) => [r.account, r])).values()].sort((a, b) =>
    a.account.localeCompare(b.account)
  );

  if (uniqueRoots.length === 1) {
    return d3.hierarchy(buildSubtree(uniqueRoots[0].account));
  }

  return d3.hierarchy({
    account: NETWORK_ROOT_ID,
    score: 0,
    children: uniqueRoots.map((r) => buildSubtree(r.account)),
  });
}

export function countHierarchyMembers(root: d3.HierarchyNode<HierarchyDatum>): number {
  let n = 0;
  root.each((d) => {
    if (d.data.account !== NETWORK_ROOT_ID) n++;
  });
  return n;
}

/** One paginated `adopters` read - score + banked on each row drive tetrahedral level colors. */
export function buildWelcomeNetworkGraph(adopters: EasyInviteAdopter[]): WelcomeNetworkGraph {
  const { accounts, childrenByInviter } = buildChildrenMap(adopters);

  const nodes: WelcomeNetworkNode[] = adopters.map((a) => ({
    id: a.account,
    score: a.score,
    banked: a.banked,
    invitedby: a.invitedby,
    level: tetrahedralLevelFromScore(a.score),
    childCount: childrenByInviter.get(a.account)?.length ?? 0,
    x: 0,
    y: 0,
  }));

  const links: WelcomeNetworkLink[] = adopters
    .filter((a) => a.invitedby && accounts.has(a.invitedby))
    .map((a) => ({ source: a.invitedby, target: a.account }));

  const hierarchyRoot = buildSpanningHierarchy(adopters);
  const hierarchyMemberCount = countHierarchyMembers(hierarchyRoot);

  return {
    nodes,
    links,
    hierarchyRoot,
    memberCount: adopters.length,
    hierarchyMemberCount,
  };
}

export function maxNetworkLevel(nodes: WelcomeNetworkNode[]): number {
  return nodes.reduce((m, n) => Math.max(m, n.level), 1);
}

type ForceOptions = {
  width: number;
  height: number;
  tangled?: boolean;
};

/** @see https://d3js.org/d3-force */
export function runForceLayout(
  graph: WelcomeNetworkGraph,
  options: ForceOptions
): d3.Simulation<WelcomeNetworkNode, undefined> {
  const { width, height, tangled } = options;
  const n = graph.nodes.length;
  const charge = tangled ? -280 - n * 0.35 : -160 - n * 0.25;
  const linkDist = tangled ? 36 + Math.log2(Math.max(n, 2)) * 8 : 56 + Math.log2(Math.max(n, 2)) * 12;

  for (const node of graph.nodes) {
    node.x = width / 2 + (Math.random() - 0.5) * Math.min(width * 0.85, 400);
    node.y = height / 2 + (Math.random() - 0.5) * Math.min(height * 0.85, 400);
  }

  const simLinks = graph.links.map((l) => ({ source: l.source, target: l.target }));

  const simulation = d3
    .forceSimulation(graph.nodes)
    .force(
      'link',
      d3
        .forceLink<WelcomeNetworkNode, d3.SimulationLinkDatum<WelcomeNetworkNode>>(simLinks)
        .id((d) => d.id)
        .distance(linkDist)
        .strength(tangled ? 0.9 : 0.65)
    )
    .force('charge', d3.forceManyBody().strength(charge))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force(
      'collision',
      d3.forceCollide<WelcomeNetworkNode>().radius((d) => nodeRadius(d) + (tangled ? 6 : 4))
    );

  simulation.stop();
  const ticks = Math.min(800, 200 + n * 3);
  for (let i = 0; i < ticks; i++) simulation.tick();

  return simulation;
}

export function countHierarchyLeaves(root: d3.HierarchyNode<HierarchyDatum>): number {
  let leaves = 0;
  root.each((d) => {
    if (d.data.account !== NETWORK_ROOT_ID && !d.children?.length) leaves++;
  });
  return leaves;
}

/** @see https://d3js.org/d3-cluster - leaves spaced evenly on the ring */
export function layoutHierarchyRadial(
  root: d3.HierarchyNode<HierarchyDatum>,
  viewportRadius: number
): { root: d3.HierarchyPointNode<HierarchyDatum>; radius: number } {
  const leaves = Math.max(1, countHierarchyLeaves(root));
  const radius = Math.max(viewportRadius, leaves * 14 + 120);
  const laidOut = d3
    .cluster<HierarchyDatum>()
    .size([2 * Math.PI, radius])
    .separation((a, b) => (a.parent === b.parent ? 2.6 : 4.5))(root);

  const minInner = Math.max(40, radius * 0.09);
  laidOut.each((d) => {
    if (d.data.account === NETWORK_ROOT_ID) return;
    if (d.depth === 0 || d.y < minInner) {
      d.y = Math.max(d.y, minInner);
    }
  });

  return { root: laidOut, radius };
}

/** @see https://d3js.org/d3-tree - left-to-right with fixed node spacing */
export function layoutHierarchyHorizontal(
  root: d3.HierarchyNode<HierarchyDatum>
): { root: d3.HierarchyPointNode<HierarchyDatum>; width: number; height: number } {
  const leaves = Math.max(1, countHierarchyLeaves(root));
  const dx = 48;
  const dy = 180;
  const laidOut = d3.tree<HierarchyDatum>().nodeSize([dx, dy])(root);
  const width = Math.max(640, (laidOut.height + 1) * dy + 120);
  const height = Math.max(400, leaves * dx + 100);
  return { root: laidOut, width, height };
}

/** @see https://d3js.org/d3-pack */
export function layoutHierarchyPack(
  root: d3.HierarchyNode<HierarchyDatum>,
  size: number
): d3.HierarchyCircularNode<HierarchyDatum> {
  const pack = d3.pack<HierarchyDatum>().size([size, size]).padding(4);
  const laidOut = root
    .sum((d) => (d.children?.length ? 0 : 1))
    .sort((a, b) => (a.height ?? 0) - (b.height ?? 0));
  return pack(laidOut);
}

export function hierarchyLevel(
  node: d3.HierarchyNode<HierarchyDatum>,
  levelByAccount: Map<string, number>
): number {
  if (node.data.account === NETWORK_ROOT_ID) return 0;
  return levelByAccount.get(node.data.account) ?? tetrahedralLevelFromScore(node.data.score);
}
