/**
 * Lazy-loaded D3 invite branch for invite.mon3y adopters (downstream by invitedby).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchAllEasyInviteAdopters,
  countUniqueDownstreamFromAdopters,
  fetchEasyInviteAdopter,
  fetchEasyInviteesByInviters,
  welcomeBackMinimumEasy,
  type EasyInviteAdopter,
} from '@/services/easyInvite';
import { cn } from '@/lib/utils';
import {
  NETWORK_ROOT_ID,
  WELCOME_LEVEL_COLORS,
  buildSpanningHierarchy,
  buildWelcomeNetworkGraph,
  hierarchyLevel,
  layoutHierarchyHorizontal,
  layoutHierarchyPack,
  layoutHierarchyRadial,
  maxNetworkLevel,
  nodeRadius,
  runForceLayout,
  welcomeLevelColor,
  type HierarchyDatum,
  type NetworkLayoutMode,
  type WelcomeNetworkGraph,
  type WelcomeNetworkNode,
} from '@/components/welcomeNetworkGraph';

export type InviteTreeDatum = {
  account: string;
  score: number;
  banked: string;
  invitedby: string;
  children: InviteTreeDatum[];
};

const EASY_INVITE_ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;

type ViewMode = 'idle' | 'downstream' | 'network';

const NETWORK_LAYOUTS: { id: NetworkLayoutMode; label: string; hint: string }[] = [
  { id: 'force', label: 'Force graph', hint: 'Best with Welcome Back loops' },
  { id: 'tangled', label: 'Tangled', hint: 'Dense force layout' },
  { id: 'radial', label: 'Radial tree', hint: 'One parent path; loops hidden' },
  { id: 'pack', label: 'Circle pack', hint: 'Nested circles; loops hidden' },
  { id: 'horizontal', label: 'Horizontal tree', hint: 'Left-to-right; roomy spacing' },
];

function buildTreeFromMaps(
  rootAccount: string,
  rootAdopter: EasyInviteAdopter | null,
  childrenByInviter: Map<string, EasyInviteAdopter[]>,
  maxDepth: number
): InviteTreeDatum {
  function node(
    account: string,
    adopter: EasyInviteAdopter | null,
    depth: number,
    visited: Set<string>
  ): InviteTreeDatum {
    const base: InviteTreeDatum = {
      account,
      score: adopter?.score ?? 0,
      banked: adopter?.banked ?? '0.000000 EASY',
      invitedby: adopter?.invitedby ?? '',
      children: [],
    };
    if (depth >= maxDepth || visited.has(account)) return base;
    visited.add(account);
    const kids = childrenByInviter.get(account) ?? [];
    base.children = kids.map((k) => node(k.account, k, depth + 1, new Set(visited)));
    return base;
  }
  return node(rootAccount, rootAdopter, 0, new Set<string>());
}

function accountsAtDepth(root: InviteTreeDatum, depth: number): string[] {
  const out: string[] = [];
  const walk = (n: InviteTreeDatum, d: number) => {
    if (d === depth) {
      out.push(n.account);
      return;
    }
    for (const child of n.children) walk(child, d + 1);
  };
  walk(root, 0);
  return out;
}

function countNodes(root: InviteTreeDatum): number {
  let n = 1;
  for (const child of root.children) n += countNodes(child);
  return n;
}

function adoptersFromGraph(graph: WelcomeNetworkGraph): EasyInviteAdopter[] {
  return graph.nodes.map((n) => ({
    account: n.id,
    score: n.score,
    banked: n.banked,
    invitedby: n.invitedby,
    lastupdated: 0,
  }));
}

function levelByAccountMap(graph: WelcomeNetworkGraph): Map<string, number> {
  return new Map(graph.nodes.map((n) => [n.id, n.level]));
}

function wireNetworkNodeClick(
  node: d3.Selection<SVGGElement, WelcomeNetworkNode, SVGGElement, unknown>,
  onSelect: (n: WelcomeNetworkNode, downstreamCount?: number) => void,
  adoptersForCount: EasyInviteAdopter[] | null
) {
  node
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation();
      const downstreamCount = adoptersForCount
        ? countUniqueDownstreamFromAdopters(d.id, adoptersForCount)
        : undefined;
      onSelect(d, downstreamCount);
    });
}

function appendNetworkNodeLabels(
  node: d3.Selection<SVGGElement, WelcomeNetworkNode, SVGGElement, unknown>
) {
  node
    .append('title')
    .text((d) => `${d.id}\nscore ${d.score}\nlevel ${d.level}\nbanked ${d.banked}`);
  node
    .append('text')
    .attr('dy', (d) => nodeRadius(d) + 10)
    .attr('text-anchor', 'middle')
    .attr('fill', '#fef9c3')
    .attr('font-size', (d) => (d.level <= 2 || d.childCount >= 2 ? 10 : 8))
    .attr('font-family', 'ui-monospace, monospace')
    .text((d) => d.id);
}

type EasyLifeBranchTreeProps = {
  rootAccount: string | null;
  className?: string;
  actor?: string | null;
  onWelcomeBackBranch?: (account: string) => void;
  onSelectNetworkNode?: (node: WelcomeNetworkNode, downstreamCount?: number) => void;
};

export function EasyLifeBranchTree({
  rootAccount,
  className,
  actor,
  onWelcomeBackBranch,
  onSelectNetworkNode,
}: EasyLifeBranchTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<WelcomeNetworkNode, undefined> | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('idle');
  const [networkLayout, setNetworkLayout] = useState<NetworkLayoutMode>('force');
  const [branchDepth, setBranchDepth] = useState(0);
  const [viewedAccountInput, setViewedAccountInput] = useState('');
  const [activeRootAccount, setActiveRootAccount] = useState<string | null>(rootAccount ?? null);
  const [rootAdopter, setRootAdopter] = useState<EasyInviteAdopter | null>(null);
  const [upstreamAdopter, setUpstreamAdopter] = useState<EasyInviteAdopter | null>(null);
  const [networkGraph, setNetworkGraph] = useState<WelcomeNetworkGraph | null>(null);
  const [childrenByInviter, setChildrenByInviter] = useState<Map<string, EasyInviteAdopter[]>>(
    () => new Map()
  );
  const [loadedInviters, setLoadedInviters] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [loadingNetwork, setLoadingNetwork] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkFullscreen, setNetworkFullscreen] = useState(false);
  const normalizedActor = actor?.trim().toLowerCase() ?? null;

  const downstreamTreeData = useMemo(() => {
    if (!activeRootAccount || branchDepth < 1 || viewMode !== 'downstream') return null;
    return buildTreeFromMaps(activeRootAccount, rootAdopter, childrenByInviter, branchDepth);
  }, [activeRootAccount, branchDepth, rootAdopter, childrenByInviter, viewMode]);

  const resetBranch = useCallback(() => {
    setBranchDepth(0);
    setRootAdopter(null);
    setUpstreamAdopter(null);
    setChildrenByInviter(new Map());
    setLoadedInviters(new Set());
  }, []);

  useEffect(() => {
    const next = rootAccount?.trim().toLowerCase() ?? '';
    setViewedAccountInput(next);
    setActiveRootAccount(next || null);
    setViewMode('idle');
    setNetworkGraph(null);
    setNetworkFullscreen(false);
    resetBranch();
    setError(null);
  }, [rootAccount, resetBranch]);

  useEffect(() => {
    if (viewMode !== 'network') setNetworkFullscreen(false);
  }, [viewMode]);

  useEffect(() => {
    if (!networkFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNetworkFullscreen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [networkFullscreen]);

  const loadDownstream = async (nextRoot?: string) => {
    const account = (nextRoot ?? activeRootAccount ?? '').trim().toLowerCase();
    if (!account) {
      setError('Type an account to load a welcome branch.');
      return;
    }
    if (!EASY_INVITE_ACCOUNT_RE.test(account)) {
      setError('Enter a valid XPR account name.');
      return;
    }

    setLoading(true);
    setError(null);
    setViewMode('downstream');
    setNetworkGraph(null);
    try {
      const adopter = await fetchEasyInviteAdopter(account);
      if (!adopter) {
        setError('This wallet has not been welcomed into the program yet.');
        setActiveRootAccount(account);
        setViewMode('idle');
        return;
      }
      const map = await fetchEasyInviteesByInviters([account]);
      setRootAdopter(adopter);
      if (adopter.invitedby) {
        setUpstreamAdopter(await fetchEasyInviteAdopter(adopter.invitedby));
      } else {
        setUpstreamAdopter(null);
      }
      setChildrenByInviter(map);
      setLoadedInviters(new Set([account]));
      setViewedAccountInput(account);
      setActiveRootAccount(account);
      setBranchDepth(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load welcome branch.');
      setViewMode('idle');
    } finally {
      setLoading(false);
    }
  };

  const loadWelcomeNetwork = async () => {
    setLoadingNetwork(true);
    setError(null);
    try {
      const adopters = await fetchAllEasyInviteAdopters();
      if (!adopters.length) {
        setError('No welcome network members on chain yet.');
        return;
      }
      setNetworkGraph(buildWelcomeNetworkGraph(adopters));
      setNetworkLayout('force');
      setViewMode('network');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load welcome network.');
    } finally {
      setLoadingNetwork(false);
    }
  };

  const loadNextEdge = async () => {
    if (!activeRootAccount || !downstreamTreeData || branchDepth < 1 || viewMode !== 'downstream') return;
    const frontier = accountsAtDepth(downstreamTreeData, branchDepth).filter(
      (account) => !loadedInviters.has(account)
    );
    if (!frontier.length) return;

    setLoading(true);
    setError(null);
    try {
      const nextMap = await fetchEasyInviteesByInviters(frontier);
      setChildrenByInviter((prev) => {
        const merged = new Map(prev);
        for (const [inv, rows] of nextMap) merged.set(inv, rows);
        return merged;
      });
      setLoadedInviters((prev) => {
        const next = new Set(prev);
        for (const inviter of frontier) next.add(inviter);
        return next;
      });
      setBranchDepth((d) => d + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load next edge.');
    } finally {
      setLoading(false);
    }
  };

  const loadSingleEdge = useCallback(
    async (account: string, depth: number) => {
      if (loading || loadedInviters.has(account)) return;
      setLoading(true);
      setError(null);
      try {
        const nextMap = await fetchEasyInviteesByInviters([account]);
        setChildrenByInviter((prev) => {
          const merged = new Map(prev);
          for (const [inv, rows] of nextMap) merged.set(inv, rows);
          return merged;
        });
        setLoadedInviters((prev) => new Set(prev).add(account));
        setBranchDepth((d) => Math.max(d, depth + 1));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load that edge.');
      } finally {
        setLoading(false);
      }
    },
    [loadedInviters, loading]
  );

  const directCount = activeRootAccount ? (childrenByInviter.get(activeRootAccount)?.length ?? 0) : 0;
  const frontierCount =
    downstreamTreeData && viewMode === 'downstream'
      ? accountsAtDepth(downstreamTreeData, branchDepth).filter((account) => !loadedInviters.has(account))
          .length
      : 0;

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg || !downstreamTreeData || viewMode !== 'downstream') return;

    const width = Math.max(container.clientWidth, 640);
    const hierarchyRoot = d3.hierarchy(downstreamTreeData, (d) =>
      d.children.length ? d.children : undefined
    );
    const layout = d3.tree<InviteTreeDatum>().nodeSize([40, 200]);
    layout(hierarchyRoot);

    const nodes = hierarchyRoot.descendants();
    const links = hierarchyRoot.links();
    const height = Math.max(280, nodes.length * 40 + 80);

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = '';

    const zoomG = d3.select(svg).append('g');
    const inner = zoomG.append('g').attr('transform', 'translate(96,48)');

    const linkGen = d3
      .linkHorizontal<d3.HierarchyPointLink<InviteTreeDatum>, d3.HierarchyPointNode<InviteTreeDatum>>()
      .x((d) => d.y)
      .y((d) => d.x);

    inner
      .append('g')
      .attr('fill', 'none')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('d', linkGen)
      .attr('stroke', 'rgba(250,204,21,0.35)')
      .attr('stroke-width', 1.5);

    const node = inner
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('transform', (d) => `translate(${d.y},${d.x})`);

    node
      .append('circle')
      .attr('r', (d) => (d.depth === 0 ? 10 : 7))
      .attr('fill', (d) => (d.depth === 0 ? '#facc15' : '#422006'))
      .attr('stroke', '#facc15')
      .attr('stroke-width', 1.5);

    node
      .append('text')
      .attr('dy', '0.32em')
      .attr('x', (d) => (d.children ? -14 : 14))
      .attr('text-anchor', (d) => (d.children ? 'end' : 'start'))
      .attr('fill', '#fef9c3')
      .attr('font-size', 12)
      .attr('font-family', 'ui-monospace, monospace')
      .text((d) => d.data.account);

    node
      .append('text')
      .attr('dy', '1.35em')
      .attr('x', (d) => (d.children ? -14 : 14))
      .attr('text-anchor', (d) => (d.children ? 'end' : 'start'))
      .attr('fill', 'rgba(254,252,232,0.55)')
      .attr('font-size', 10)
      .text((d) => `score ${d.data.score}`);

    const rootNode = nodes.find((n) => n.depth === 0);
    if (rootNode && upstreamAdopter?.account) {
      const upstreamY = -140;
      const upstreamX = rootNode.x;
      inner
        .append('path')
        .attr(
          'd',
          `M ${upstreamY},${upstreamX} C -100,${upstreamX} -40,${rootNode.x} ${rootNode.y},${rootNode.x}`
        )
        .attr('fill', 'none')
        .attr('stroke', 'rgba(250,204,21,0.22)')
        .attr('stroke-dasharray', '4 4')
        .attr('stroke-width', 1.2);

      const upstreamNode = inner.append('g').attr('transform', `translate(${upstreamY},${upstreamX})`);
      upstreamNode.append('circle').attr('r', 8).attr('fill', 'rgba(250,204,21,0.08)').attr('stroke', 'rgba(250,204,21,0.4)');
      upstreamNode
        .append('text')
        .attr('dy', '-0.9em')
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(254,252,232,0.45)')
        .attr('font-size', 10)
        .text('upstream +1');
      upstreamNode
        .append('text')
        .attr('dy', '0.32em')
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(254,252,232,0.65)')
        .attr('font-size', 11)
        .attr('font-family', 'ui-monospace, monospace')
        .text(upstreamAdopter.account);
    }

    const expandable = (d: d3.HierarchyPointNode<InviteTreeDatum>) =>
      d.data.score > 1 && !loadedInviters.has(d.data.account);
    const welcomeBackTarget = (d: d3.HierarchyPointNode<InviteTreeDatum>) =>
      Boolean(
        onWelcomeBackBranch &&
          !expandable(d) &&
          loadedInviters.has(d.data.account) &&
          d.data.children.length > 0 &&
          d.data.account !== normalizedActor
      );

    node
      .style('cursor', (d) => (expandable(d) || welcomeBackTarget(d) ? 'pointer' : 'default'))
      .on('click', (_, d) => {
        if (expandable(d)) {
          void loadSingleEdge(d.data.account, d.depth);
          return;
        }
        if (welcomeBackTarget(d)) onWelcomeBackBranch?.(d.data.account);
      });

    node
      .append('text')
      .filter((d) => expandable(d))
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('fill', '#facc15')
      .attr('font-size', 10)
      .attr('font-weight', 700)
      .text('+');

    node
      .append('text')
      .filter((d) => welcomeBackTarget(d))
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('fill', '#facc15')
      .attr('font-size', 10)
      .attr('font-weight', 800)
      .text('$')
      .append('title')
      .text((d) => {
        const min = welcomeBackMinimumEasy(d.data.score);
        return `Welcome Back ${d.data.account}'s downstream (${min} EASY, score ${d.data.score})`;
      });

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 3])
      .on('zoom', (event) => {
        zoomG.attr('transform', event.transform);
      });
    d3.select(svg).call(zoom);

    return () => {
      d3.select(svg).on('.zoom', null);
    };
  }, [
    downstreamTreeData,
    viewMode,
    upstreamAdopter,
    loadedInviters,
    loadSingleEdge,
    normalizedActor,
    onWelcomeBackBranch,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg || !networkGraph || viewMode !== 'network') return;

    simulationRef.current?.stop();
    simulationRef.current = null;

    const width = Math.max(container.clientWidth, 640);
    const height = networkFullscreen
      ? Math.max(container.clientHeight, 480)
      : Math.max(480, Math.min(720, width * 0.72));

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = '';

    const zoomG = d3.select(svg).append('g');
    const inner = zoomG.append('g');
    const layout = networkLayout;
    const levelByAccount = levelByAccountMap(networkGraph);
    const hierarchyRoot = buildSpanningHierarchy(adoptersFromGraph(networkGraph));
    const adoptersForCount = adoptersFromGraph(networkGraph);

    if (layout === 'force' || layout === 'tangled') {
      const sim = runForceLayout(networkGraph, { width, height, tangled: layout === 'tangled' });
      simulationRef.current = sim;

      const nodeById = new Map(networkGraph.nodes.map((n) => [n.id, n]));
      const linkData = networkGraph.links
        .map((l) => ({
          source: nodeById.get(l.source)!,
          target: nodeById.get(l.target)!,
        }))
        .filter((l) => l.source && l.target);

      const link = inner
        .append('g')
        .attr('fill', 'none')
        .selectAll('line')
        .data(linkData)
        .join('line')
        .attr('stroke', (l) => `${welcomeLevelColor(l.target.level)}66`)
        .attr('stroke-width', 1.2);

      const node = inner
        .append('g')
        .selectAll('g')
        .data(networkGraph.nodes, (d) => d.id)
        .join('g')
        .attr('transform', (d) => `translate(${d.x},${d.y})`);

      node
        .append('circle')
        .attr('r', (d) => nodeRadius(d))
        .attr('fill', (d) => welcomeLevelColor(d.level))
        .attr('stroke', (d) => welcomeLevelColor(d.level))
        .attr('stroke-width', 1.4);

      appendNetworkNodeLabels(node);
      if (onSelectNetworkNode) wireNetworkNodeClick(node, onSelectNetworkNode, adoptersForCount);

      sim.on('tick', () => {
        link
          .attr('x1', (l) => l.source.x)
          .attr('y1', (l) => l.source.y)
          .attr('x2', (l) => l.target.x)
          .attr('y2', (l) => l.target.y);
        node.attr('transform', (d) => `translate(${d.x},${d.y})`);
      });

      for (let i = 0; i < 60; i++) sim.tick();
      link
        .attr('x1', (l) => l.source.x)
        .attr('y1', (l) => l.source.y)
        .attr('x2', (l) => l.target.x)
        .attr('y2', (l) => l.target.y);
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    } else if (layout === 'radial') {
      const viewportRadius = Math.min(width, height) * 0.42;
      const { root: radialRoot, radius } = layoutHierarchyRadial(hierarchyRoot, viewportRadius);
      const layoutSize = radius * 2 + 80;
      svg.setAttribute('viewBox', `0 0 ${layoutSize} ${layoutSize}`);

      const rcx = layoutSize / 2;
      const rcy = layoutSize / 2;
      inner.attr('transform', `translate(${rcx},${rcy})`);

      const descendants = radialRoot.descendants().filter((d) => d.data.account !== NETWORK_ROOT_ID);

      const linkRadial = d3
        .linkRadial<d3.HierarchyPointLink<typeof radialRoot.data>, d3.HierarchyPointNode<typeof radialRoot.data>>()
        .angle((d) => d.x)
        .radius((d) => d.y);

      inner
        .append('g')
        .attr('fill', 'none')
        .selectAll('path')
        .data(radialRoot.links().filter((l) => l.target.data.account !== NETWORK_ROOT_ID))
        .join('path')
        .attr('d', linkRadial)
        .attr('stroke', (l) => `${welcomeLevelColor(hierarchyLevel(l.target, levelByAccount))}55`)
        .attr('stroke-width', 1.2);

      const radialNodes: WelcomeNetworkNode[] = descendants.map((d) => {
        const meta = networkGraph.nodes.find((n) => n.id === d.data.account);
        const angle = d.x - Math.PI / 2;
        const lvl = hierarchyLevel(d, levelByAccount);
        return {
          id: d.data.account,
          score: d.data.score,
          banked: meta?.banked ?? '',
          invitedby: meta?.invitedby ?? '',
          level: lvl,
          childCount: meta?.childCount ?? 0,
          x: d.y * Math.cos(angle),
          y: d.y * Math.sin(angle),
        };
      });

      const node = inner
        .append('g')
        .selectAll('g')
        .data(radialNodes, (d) => d.id)
        .join('g')
        .attr('transform', (d) => `translate(${d.x},${d.y})`);

      node
        .append('circle')
        .attr('r', (d) => nodeRadius(d) + (d.id === radialRoot.data.account ? 3 : 0))
        .attr('fill', (d) => welcomeLevelColor(d.level))
        .attr('stroke', (d) => welcomeLevelColor(d.level))
        .attr('stroke-width', (d) => (d.id === radialRoot.data.account ? 2 : 1.2));

      appendNetworkNodeLabels(node);
      if (onSelectNetworkNode) wireNetworkNodeClick(node, onSelectNetworkNode, adoptersForCount);
    } else if (layout === 'horizontal') {
      const { root: hRoot, width: treeW, height: treeH } = layoutHierarchyHorizontal(hierarchyRoot);
      svg.setAttribute('viewBox', `0 0 ${treeW} ${treeH}`);

      const hInner = inner.attr('transform', 'translate(64,48)');
      const descendants = hRoot.descendants().filter((d) => d.data.account !== NETWORK_ROOT_ID);
      const links = hRoot.links().filter((l) => l.target.data.account !== NETWORK_ROOT_ID);

      const linkGen = d3
        .linkHorizontal<d3.HierarchyPointLink<HierarchyDatum>, d3.HierarchyPointNode<HierarchyDatum>>()
        .x((d) => d.y)
        .y((d) => d.x);

      hInner
        .append('g')
        .attr('fill', 'none')
        .selectAll('path')
        .data(links)
        .join('path')
        .attr('d', linkGen)
        .attr('stroke', (l) => `${welcomeLevelColor(hierarchyLevel(l.target, levelByAccount))}55`)
        .attr('stroke-width', 1.2);

      const horizontalNodes: WelcomeNetworkNode[] = descendants.map((d) => {
        const meta = networkGraph.nodes.find((n) => n.id === d.data.account);
        return {
          id: d.data.account,
          score: d.data.score,
          banked: meta?.banked ?? '',
          invitedby: meta?.invitedby ?? '',
          level: hierarchyLevel(d, levelByAccount),
          childCount: meta?.childCount ?? 0,
          x: d.y,
          y: d.x,
        };
      });

      const node = hInner
        .append('g')
        .selectAll('g')
        .data(horizontalNodes, (d) => d.id)
        .join('g')
        .attr('transform', (d) => `translate(${d.x},${d.y})`);

      node
        .append('circle')
        .attr('r', (d) => nodeRadius(d))
        .attr('fill', (d) => welcomeLevelColor(d.level))
        .attr('stroke', (d) => welcomeLevelColor(d.level));

      appendNetworkNodeLabels(node);
      if (onSelectNetworkNode) wireNetworkNodeClick(node, onSelectNetworkNode, adoptersForCount);
    } else if (layout === 'pack') {
      const size = Math.min(width, height) - 32;
      const root = layoutHierarchyPack(hierarchyRoot, size);
      const circles = root.descendants().filter((d) => d.data.account !== NETWORK_ROOT_ID);

      inner.attr('transform', `translate(${(width - size) / 2},${(height - size) / 2})`);

      const packNodes: WelcomeNetworkNode[] = circles.map((d) => {
        const meta = networkGraph.nodes.find((n) => n.id === d.data.account);
        const lvl = hierarchyLevel(d, levelByAccount);
        return {
          id: d.data.account,
          score: d.data.score,
          banked: meta?.banked ?? '',
          invitedby: meta?.invitedby ?? '',
          level: lvl,
          childCount: meta?.childCount ?? 0,
          x: d.x,
          y: d.y,
          r: d.r,
        };
      });

      type PackNode = WelcomeNetworkNode & { r: number };

      const node = inner
        .append('g')
        .selectAll('g')
        .data(packNodes as PackNode[], (d) => d.id)
        .join('g')
        .attr('transform', (d) => `translate(${d.x},${d.y})`);

      node
        .append('circle')
        .attr('r', (d) => Math.max(2.5, d.r))
        .attr('fill', (d) => welcomeLevelColor(d.level))
        .attr('fill-opacity', (d) => (d.childCount > 0 ? 0.35 : 0.9))
        .attr('stroke', (d) => welcomeLevelColor(d.level))
        .attr('stroke-width', (d) => (d.r > 8 ? 1.2 : 0.6));

      node
        .filter((d) => d.r > 14)
        .call((sel) => appendNetworkNodeLabels(sel as d3.Selection<SVGGElement, WelcomeNetworkNode, SVGGElement, unknown>));
      if (onSelectNetworkNode) wireNetworkNodeClick(node, onSelectNetworkNode, adoptersForCount);
    }

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.12, 4])
      .on('zoom', (event) => {
        zoomG.attr('transform', event.transform);
      });
    d3.select(svg).call(zoom);

    return () => {
      simulationRef.current?.stop();
      simulationRef.current = null;
      d3.select(svg).on('.zoom', null);
    };
  }, [networkGraph, networkLayout, viewMode, onSelectNetworkNode, networkFullscreen]);

  const networkMaxLevel = networkGraph ? maxNetworkLevel(networkGraph.nodes) : 0;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-yellow-100/50">Account</p>
          <Input
            value={viewedAccountInput}
            onChange={(event) => setViewedAccountInput(event.target.value.toLowerCase())}
            placeholder={rootAccount ? 'Type any account' : 'accountname'}
            className="border-yellow-300/20 bg-black/70 font-mono text-yellow-50"
          />
        </div>
        <Button
          type="button"
          onClick={() => void loadDownstream(viewedAccountInput)}
          disabled={loading || loadingNetwork}
          className="bg-yellow-300 text-black hover:bg-yellow-200"
        >
          {loading && viewMode !== 'network' && branchDepth < 1 ? 'Loading…' : 'View downstream'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadNextEdge()}
          disabled={
            viewMode !== 'downstream' ||
            !downstreamTreeData ||
            loading ||
            loadingNetwork ||
            branchDepth < 1 ||
            frontierCount === 0
          }
          className="border-yellow-300/30 bg-black/50 text-yellow-100 hover:bg-yellow-300 hover:text-black"
        >
          {loading && viewMode === 'downstream' && branchDepth >= 1 ? 'Loading next edge…' : 'Load next edge'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadWelcomeNetwork()}
          disabled={loading || loadingNetwork}
          className="border-yellow-300/30 bg-black/50 text-yellow-100 hover:bg-yellow-300 hover:text-black"
        >
          {loadingNetwork ? 'Loading network…' : 'View welcome network'}
        </Button>
        {viewMode === 'downstream' && downstreamTreeData ? (
          <span className="text-sm text-yellow-100/55">
            {countNodes(downstreamTreeData)} on chart · depth {branchDepth}
            {branchDepth === 1 ? ` · ${directCount} direct` : ''}
          </span>
        ) : null}
        {viewMode === 'network' && networkGraph ? (
          <span className="text-sm text-yellow-100/55">
            {networkGraph.memberCount} members · {networkMaxLevel} levels
            {networkGraph.hierarchyMemberCount !== networkGraph.memberCount
              ? ` · tree shows ${networkGraph.hierarchyMemberCount}`
              : ''}
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          'space-y-4',
          networkFullscreen &&
            'fixed inset-0 z-50 flex flex-col space-y-3 overflow-hidden bg-[#020202] p-4 sm:p-6'
        )}
      >
        {viewMode === 'network' && networkGraph ? (
          <>
            <div className="flex flex-wrap gap-2">
              {NETWORK_LAYOUTS.map(({ id, label, hint }) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={networkLayout === id ? 'default' : 'outline'}
                  title={hint}
                  onClick={() => setNetworkLayout(id)}
                  className={
                    networkLayout === id
                      ? 'bg-yellow-300 text-black hover:bg-yellow-200'
                      : 'border-yellow-300/30 bg-black/50 text-yellow-100 hover:bg-yellow-300/20'
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3 text-xs text-yellow-100/55">
                {WELCOME_LEVEL_COLORS.map((color, i) => (
                  <span key={color} className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    Level {i + 1}
                    {i === WELCOME_LEVEL_COLORS.length - 1 ? '+' : ''}
                  </span>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setNetworkFullscreen((open) => !open)}
                aria-label={networkFullscreen ? 'Exit full screen' : 'Full screen welcome network'}
                title={networkFullscreen ? 'Exit full screen' : 'Full screen'}
                className="border-yellow-300/30 bg-black/50 text-yellow-100 hover:bg-yellow-300/20"
              >
                {networkFullscreen ? (
                  <Minimize2 className="h-4 w-4" aria-hidden />
                ) : (
                  <Maximize2 className="h-4 w-4" aria-hidden />
                )}
                <span>{networkFullscreen ? 'Exit' : 'Full screen'}</span>
              </Button>
            </div>
            {networkLayout !== 'force' && networkLayout !== 'tangled' ? (
              <p className="text-xs text-yellow-100/45">
                Tree layouts show one parent path per account. Welcome Back loops appear fully in Force / Tangled only.
              </p>
            ) : null}
          </>
        ) : null}

        {!rootAccount ? (
          <p className="text-sm text-yellow-100/55">Connect a wallet or type an account to inspect the welcome network.</p>
        ) : null}

        {error ? <p className="text-sm text-red-300/90">{error}</p> : null}

        <div
          ref={containerRef}
          className={cn(
            'min-h-[320px] overflow-hidden rounded-[1.5rem] border border-yellow-300/15 bg-black/60',
            networkFullscreen && 'min-h-0 flex-1 rounded-none border-yellow-300/20'
          )}
        >
          {(viewMode === 'network' && networkGraph) || (viewMode === 'downstream' && downstreamTreeData) ? (
            <svg
              ref={svgRef}
              className={cn(
                'h-full w-full touch-none',
                networkFullscreen ? 'min-h-0' : 'min-h-[480px]'
              )}
              role="img"
              aria-label={viewMode === 'network' ? 'Full welcome network' : 'Invite branch tree'}
            />
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-yellow-100/45">
              <p>
                {loadingNetwork
                  ? 'Loading full welcome network…'
                  : 'Your downstream welcomes appear here after you load a branch.'}
              </p>
              <p className="text-xs">
                <span className="font-semibold text-yellow-200/80">View welcome network</span> loads all adopters - use{' '}
                <span className="font-semibold text-yellow-200/80">Force graph</span> when Welcome Back creates loops.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
