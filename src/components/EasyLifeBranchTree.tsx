/**
 * Lazy-loaded D3 invite branch for invite.mon3y adopters (downstream by invitedby).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Button } from '@/components/ui/button';
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

function buildTreeFromMaps(
  rootAccount: string,
  rootAdopter: EasyInviteAdopter | null,
  childrenByInviter: Map<string, EasyInviteAdopter[]>,
  maxDepth: number
): InviteTreeDatum {
  function node(account: string, adopter: EasyInviteAdopter | null, depth: number): InviteTreeDatum {
    const base: InviteTreeDatum = {
      account,
      score: adopter?.score ?? 0,
      banked: adopter?.banked ?? '0.000000 EASY',
      invitedby: adopter?.invitedby ?? '',
      children: [],
    };
    if (depth >= maxDepth) return base;
    const kids = childrenByInviter.get(account) ?? [];
    base.children = kids.map((k) => node(k.account, k, depth + 1));
    return base;
  }
  return node(rootAccount, rootAdopter, 0);
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
};

export function EasyLifeBranchTree({ rootAccount, className }: EasyLifeBranchTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [branchDepth, setBranchDepth] = useState(0);
  const [rootAdopter, setRootAdopter] = useState<EasyInviteAdopter | null>(null);
  const [childrenByInviter, setChildrenByInviter] = useState<Map<string, EasyInviteAdopter[]>>(
    () => new Map()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const treeData = useMemo(() => {
    if (!rootAccount || branchDepth < 1) return null;
    return buildTreeFromMaps(rootAccount, rootAdopter, childrenByInviter, branchDepth);
  }, [rootAccount, branchDepth, rootAdopter, childrenByInviter]);

  const reset = useCallback(() => {
    setBranchDepth(0);
    setRootAdopter(null);
    setChildrenByInviter(new Map());
    setError(null);
  }, []);

  useEffect(() => {
    reset();
  }, [rootAccount, reset]);

  const loadBranch = async () => {
    if (!rootAccount) return;
    setLoading(true);
    setError(null);
    try {
      const adopter = await fetchEasyInviteAdopter(rootAccount);
      if (!adopter) {
        setError('This wallet has not been welcomed into the program yet.');
        return;
      }
      const map = await fetchEasyInviteesByInviters([rootAccount]);
      setRootAdopter(adopter);
      setChildrenByInviter(map);
      setBranchDepth(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load welcome branch.');
    } finally {
      setLoading(false);
    }
  };

  const loadNextEdge = async () => {
    if (!rootAccount || !treeData || branchDepth < 1) return;
    const frontier = accountsAtDepth(treeData, branchDepth);
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
      setBranchDepth((d) => d + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load next edge.');
    } finally {
      setLoading(false);
    }
  };

  const directCount = rootAccount ? (childrenByInviter.get(rootAccount)?.length ?? 0) : 0;
  const frontierCount = treeData ? accountsAtDepth(treeData, branchDepth).length : 0;

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
  }, [treeData]);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => void loadBranch()}
          disabled={!rootAccount || loading}
          className="bg-yellow-300 text-black hover:bg-yellow-200"
        >
          {loading && branchDepth < 1 ? 'Loading branch…' : 'Load welcome branch'}
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
        <p className="text-sm text-yellow-100/55">Connect a wallet to see your welcome network.</p>
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
            <p>Your downstream welcomes appear here after you load the branch.</p>
            <p className="text-xs">Each &quot;Load next edge&quot; adds one more hop — one chain scan per click.</p>
          </div>
        )}
      </div>
    </div>
  );
}
