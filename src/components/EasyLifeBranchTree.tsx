/**
 * Lazy-loaded D3 invite branch for invite.mon3y adopters (downstream by invitedby).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchEasyInviteAdopter,
  fetchEasyInviteesByInviters,
  type EasyInviteAdopter,
} from '@/services/easyInvite';
import { cn } from '@/lib/utils';

export type InviteTreeDatum = {
  account: string;
  score: number;
  banked: string;
  invitedby: string;
  children: InviteTreeDatum[];
};

const EASY_INVITE_ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;

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

type EasyLifeBranchTreeProps = {
  rootAccount: string | null;
  className?: string;
  actor?: string | null;
  onWelcomeBackBranch?: (account: string) => void;
};

export function EasyLifeBranchTree({
  rootAccount,
  className,
  actor,
  onWelcomeBackBranch,
}: EasyLifeBranchTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [branchDepth, setBranchDepth] = useState(0);
  const [viewedAccountInput, setViewedAccountInput] = useState('');
  const [activeRootAccount, setActiveRootAccount] = useState<string | null>(rootAccount ?? null);
  const [rootAdopter, setRootAdopter] = useState<EasyInviteAdopter | null>(null);
  const [upstreamAdopter, setUpstreamAdopter] = useState<EasyInviteAdopter | null>(null);
  const [childrenByInviter, setChildrenByInviter] = useState<Map<string, EasyInviteAdopter[]>>(
    () => new Map()
  );
  const [loadedInviters, setLoadedInviters] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedActor = actor?.trim().toLowerCase() ?? null;

  const treeData = useMemo(() => {
    if (!activeRootAccount || branchDepth < 1) return null;
    return buildTreeFromMaps(activeRootAccount, rootAdopter, childrenByInviter, branchDepth);
  }, [activeRootAccount, branchDepth, rootAdopter, childrenByInviter]);

  const reset = useCallback(() => {
    setBranchDepth(0);
    setRootAdopter(null);
    setUpstreamAdopter(null);
    setChildrenByInviter(new Map());
    setLoadedInviters(new Set());
    setError(null);
  }, []);

  useEffect(() => {
    const next = rootAccount?.trim().toLowerCase() ?? '';
    setViewedAccountInput(next);
    setActiveRootAccount(next || null);
    reset();
  }, [rootAccount, reset]);

  const loadBranch = async (nextRoot?: string) => {
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
    try {
      const adopter = await fetchEasyInviteAdopter(account);
      if (!adopter) {
        setError('This wallet has not been welcomed into the program yet.');
        setActiveRootAccount(account);
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
    } finally {
      setLoading(false);
    }
  };

  const loadNextEdge = async () => {
    if (!activeRootAccount || !treeData || branchDepth < 1) return;
    const frontier = accountsAtDepth(treeData, branchDepth).filter((account) => !loadedInviters.has(account));
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

  const loadSingleEdge = useCallback(async (account: string, depth: number) => {
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
  }, [loadedInviters, loading]);

  const directCount = activeRootAccount ? (childrenByInviter.get(activeRootAccount)?.length ?? 0) : 0;
  const frontierCount = treeData
    ? accountsAtDepth(treeData, branchDepth).filter((account) => !loadedInviters.has(account)).length
    : 0;

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg || !treeData) return;

    const width = Math.max(container.clientWidth, 640);
    const hierarchyRoot = d3.hierarchy(treeData, (d) => (d.children.length ? d.children : undefined));
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
      .attr('stroke', 'rgba(250,204,21,0.35)')
      .attr('stroke-width', 1.5)
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('d', linkGen);

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
      upstreamNode
        .append('circle')
        .attr('r', 8)
        .attr('fill', 'rgba(250,204,21,0.08)')
        .attr('stroke', 'rgba(250,204,21,0.4)')
        .attr('stroke-width', 1.2);
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
        if (welcomeBackTarget(d)) {
          onWelcomeBackBranch?.(d.data.account);
        }
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
      .text((d) => `Welcome Back ${d.data.account}'s downstream`);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 2.5])
      .on('zoom', (event) => {
        zoomG.attr('transform', event.transform);
      });

    d3.select(svg).call(zoom);

    return () => {
      d3.select(svg).on('.zoom', null);
    };
  }, [treeData, upstreamAdopter, loadedInviters, loadSingleEdge, normalizedActor, onWelcomeBackBranch]);

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
          onClick={() => void loadBranch(viewedAccountInput)}
          disabled={loading}
          className="bg-yellow-300 text-black hover:bg-yellow-200"
        >
          {loading && branchDepth < 1 ? 'Loading branch…' : 'View network'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadNextEdge()}
          disabled={!treeData || loading || branchDepth < 1 || frontierCount === 0}
          className="border-yellow-300/30 bg-black/50 text-yellow-100 hover:bg-yellow-300 hover:text-black"
        >
          {loading && branchDepth >= 1 ? 'Loading next edge…' : 'Load next edge'}
        </Button>
        {branchDepth > 0 && treeData ? (
          <span className="text-sm text-yellow-100/55">
            {countNodes(treeData)} on chart · depth {branchDepth}
            {branchDepth === 1 ? ` · ${directCount} direct` : ''}
          </span>
        ) : null}
      </div>

      {!rootAccount ? (
        <p className="text-sm text-yellow-100/55">Connect a wallet or type an account to inspect the welcome network.</p>
      ) : null}

      {error ? <p className="text-sm text-red-300/90">{error}</p> : null}

      <div
        ref={containerRef}
        className="min-h-[320px] overflow-hidden rounded-[1.5rem] border border-yellow-300/15 bg-black/60"
      >
        {treeData ? (
          <svg ref={svgRef} className="h-full min-h-[320px] w-full touch-none" role="img" aria-label="Invite branch tree" />
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-yellow-100/45">
            <p>Your downstream welcomes appear here after you load a branch.</p>
            <p className="text-xs">
              Each &quot;Load next edge&quot; adds one more hop. <span className="text-yellow-300">+</span> loads a hidden
              downstream; <span className="text-yellow-300">$</span> opens a 1000 EASY Welcome Back for a displayed
              branch.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
