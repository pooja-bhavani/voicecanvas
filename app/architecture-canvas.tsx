"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  Activity,
  Boxes,
  Cable,
  Cloud,
  Cpu,
  Database,
  Globe2,
  Layers3,
  Radio,
  Server,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import type { ArchitectureService, ServiceKind } from "./lib/architecture";

type ServiceData = {
  title: string;
  subtitle: string;
  kind: ServiceKind;
  color: string;
  tag?: string;
  description?: string;
};

type ServiceNodeProps = NodeProps<Node<ServiceData>>;

const iconMap = {
  internet: Globe2,
  cdn: Cloud,
  gateway: Cable,
  service: Boxes,
  worker: Cpu,
  stream: Radio,
  database: Database,
  cache: Zap,
} satisfies Record<ServiceKind, typeof Globe2>;

function ServiceNode({ data, selected }: ServiceNodeProps) {
  const Icon = iconMap[data.kind];

  return (
    <div
      className={`relative w-[194px] rounded-xl border bg-white p-3 shadow-[0_5px_18px_rgba(32,56,43,0.07)] transition-shadow ${
        selected
          ? "border-[#4d9a72] shadow-[0_0_0_3px_rgba(77,154,114,0.12)]"
          : "border-[#e4eae5]"
      }`}
    >
      <Handle id="left" type="target" position={Position.Left} />
      <Handle id="right" type="source" position={Position.Right} />
      <Handle id="top" type="source" position={Position.Top} />
      <Handle id="bottom" type="source" position={Position.Bottom} />
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        className="target-handle"
      />
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: `${data.color}16`, color: data.color }}
        >
          <Icon size={19} strokeWidth={1.9} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold text-[#26352d]">
            {data.title}
          </div>
          <div className="mt-1 truncate text-[10px] text-[#849189]">
            {data.subtitle}
          </div>
        </div>
        {data.tag && (
          <span className="absolute right-2 top-2 rounded-full bg-[#f0f6f1] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-[#63806e]">
            {data.tag}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-1.5 border-t border-[#f0f2f0] pt-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#59a77b]" />
        <span className="text-[9px] font-medium text-[#88948d]">
          {data.kind === "internet" ? "Public" : "Healthy"}
        </span>
      </div>
    </div>
  );
}

const nodeTypes = { service: ServiceNode };

const initialNodes: Node<ServiceData>[] = [
  {
    id: "internet",
    type: "service",
    position: { x: 36, y: 284 },
    data: {
      title: "Internet",
      subtitle: "Public traffic",
      kind: "internet",
      color: "#538b72",
    },
  },
  {
    id: "gateway",
    type: "service",
    position: { x: 284, y: 284 },
    data: {
      title: "API Gateway",
      subtitle: "AWS API Gateway",
      kind: "gateway",
      color: "#be8a39",
      tag: "Edge",
    },
  },
  {
    id: "auth",
    type: "service",
    position: { x: 548, y: 128 },
    data: {
      title: "Auth service",
      subtitle: "Identity · Node.js",
      kind: "service",
      color: "#6c73bd",
    },
  },
  {
    id: "orders",
    type: "service",
    position: { x: 548, y: 394 },
    data: {
      title: "Orders service",
      subtitle: "Core API · Node.js",
      kind: "service",
      color: "#4d9b78",
      tag: "ECS",
    },
  },
  {
    id: "postgres",
    type: "service",
    position: { x: 816, y: 394 },
    data: {
      title: "PostgreSQL",
      subtitle: "RDS · Multi-AZ",
      kind: "database",
      color: "#547fa9",
    },
  },
  {
    id: "redis",
    type: "service",
    position: { x: 548, y: 644 },
    data: {
      title: "Redis cache",
      subtitle: "ElastiCache · 2 nodes",
      kind: "cache",
      color: "#c46d5c",
    },
  },
];

const edgeStyle = { stroke: "#789587", strokeWidth: 1.6 };

const initialEdges: Edge[] = [
  {
    id: "internet-gateway",
    source: "internet",
    target: "gateway",
    sourceHandle: "right",
    targetHandle: "left",
    animated: true,
    label: "HTTPS",
    labelStyle: { fill: "#74837a", fontSize: 10 },
    labelBgStyle: { fill: "#f8faf8", fillOpacity: 0.92 },
    style: edgeStyle,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#438368", width: 14, height: 14 },
  },
  {
    id: "gateway-auth",
    source: "gateway",
    target: "auth",
    sourceHandle: "top",
    targetHandle: "left",
    animated: true,
    style: edgeStyle,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#438368", width: 14, height: 14 },
  },
  {
    id: "gateway-orders",
    source: "gateway",
    target: "orders",
    sourceHandle: "bottom",
    targetHandle: "left",
    animated: true,
    style: edgeStyle,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#438368", width: 14, height: 14 },
  },
  {
    id: "orders-postgres",
    source: "orders",
    target: "postgres",
    sourceHandle: "right",
    targetHandle: "left",
    animated: true,
    label: "SQL",
    labelStyle: { fill: "#74837a", fontSize: 10 },
    labelBgStyle: { fill: "#f8faf8", fillOpacity: 0.92 },
    style: edgeStyle,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#438368", width: 14, height: 14 },
  },
  {
    id: "orders-redis",
    source: "orders",
    target: "redis",
    sourceHandle: "bottom",
    targetHandle: "target-top",
    animated: true,
    style: edgeStyle,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#438368", width: 14, height: 14 },
  },
];

const nodeDescriptions: Record<ServiceKind, string> = {
  internet: "Public entry point for customer traffic over HTTPS.",
  cdn: "Edge delivery and caching for global user traffic.",
  gateway: "Routes requests, applies throttling, and validates API access.",
  service: "A stateless containerized service running on Amazon ECS.",
  worker: "An asynchronous worker that processes background events.",
  stream: "A durable event stream for asynchronous service communication.",
  database: "Encrypted PostgreSQL with automated backups and Multi-AZ failover.",
  cache: "In-memory Redis cache for low-latency reads and session data.",
};

const serviceColors: Record<ServiceKind, string> = {
  internet: "#538b72",
  cdn: "#517fa6",
  gateway: "#be8a39",
  service: "#4d9b78",
  worker: "#8a69ae",
  stream: "#bd7544",
  database: "#547fa9",
  cache: "#c46d5c",
};

function createArchitectureGraph(services: ArchitectureService[]) {
  const nodes: Node<ServiceData>[] = services.map((service, index) => {
    const sameKindBefore = services
      .slice(0, index)
      .filter((item) => item.kind === service.kind).length;
    const position =
      service.kind === "internet" || service.kind === "cdn"
        ? { x: 36, y: 284 }
        : service.kind === "gateway"
          ? { x: 284, y: 284 }
          : service.kind === "stream" || service.kind === "database" || service.kind === "cache"
            ? { x: 816, y: 110 + index * 145 }
            : { x: 548, y: 110 + index * 125 };

    return {
      id: `${service.kind}-${index}`,
      type: "service",
      position,
      data: {
        title: service.name,
        subtitle: service.description,
        kind: service.kind,
        color: serviceColors[service.kind],
        description: service.description,
        ...(service.kind === "gateway" ? { tag: "Edge" } : {}),
      },
    };
  });

  const internet = nodes.find((node) => node.data.kind === "internet");
  const cdn = nodes.find((node) => node.data.kind === "cdn");
  const gateway = nodes.find((node) => node.data.kind === "gateway");
  const entry = cdn ?? internet;
  const appServices = nodes.filter(
    (node) => node.data.kind === "service" || node.data.kind === "worker",
  );
  const workers = nodes.filter((node) => node.data.kind === "worker");
  const streams = nodes.filter((node) => node.data.kind === "stream");
  const dataServices = nodes.filter(
    (node) =>
      node.data.kind === "database" ||
      node.data.kind === "cache" ||
      node.data.kind === "stream",
  );
  const createEdge = (
    id: string,
    source: Node<ServiceData>,
    target: Node<ServiceData>,
  ): Edge => ({
    id,
    source: source.id,
    target: target.id,
    sourceHandle: source.data.kind === "gateway" ? "bottom" : "right",
    targetHandle:
      target.data.kind === "cache" || target.data.kind === "stream"
        ? "target-top"
        : "left",
    animated: true,
    type: "smoothstep",
    style: edgeStyle,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#438368", width: 14, height: 14 },
  });
  const edges: Edge[] = [];

  if (entry && gateway) edges.push(createEdge("generated-entry-gateway", entry, gateway));
  else if (internet && cdn) edges.push(createEdge("generated-internet-cdn", internet, cdn));
  if (gateway) {
    appServices.forEach((service, index) =>
      edges.push(createEdge(`generated-gateway-service-${index}`, gateway, service)),
    );
  } else if (entry) {
    appServices.forEach((service, index) =>
      edges.push(createEdge(`generated-entry-service-${index}`, entry, service)),
    );
  }
  const paymentService = appServices.find((node) =>
    /payment|order|transaction/i.test(node.data.title),
  );
  const eventSource = paymentService ?? appServices[0] ?? gateway;
  streams.forEach((stream, index) => {
    if (eventSource) edges.push(createEdge(`generated-stream-${index}`, eventSource, stream));
  });
  workers.forEach((worker, index) => {
    const source = streams[index % Math.max(streams.length, 1)] ?? eventSource;
    if (source && source.id !== worker.id) {
      edges.push(createEdge(`generated-worker-${index}`, source, worker));
    }
  });
  dataServices
    .filter((service) => service.data.kind !== "stream")
    .forEach((service, index) => {
      const source =
        service.data.kind === "cache"
          ? appServices.find((node) => /auth|identity/i.test(node.data.title)) ??
            paymentService ??
            appServices[0]
          : paymentService ?? appServices[0];
      if (source && source.id !== service.id) {
        edges.push(createEdge(`generated-data-${index}`, source, service));
      }
    });

  return { nodes, edges };
}

function CanvasContent({
  onSelectionChange,
  resetKey,
  architectureServices,
}: {
  onSelectionChange: (data: ServiceData | null) => void;
  resetKey: number;
  architectureServices: ArchitectureService[] | null;
}) {
  const graph = useMemo(
    () => (architectureServices ? createArchitectureGraph(architectureServices) : null),
    [architectureServices, resetKey],
  );
  const nodes = graph?.nodes ?? initialNodes;
  const edges = graph?.edges ?? initialEdges;
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<ServiceData>) => {
      onSelectionChange(node.data);
    },
    [onSelectionChange],
  );

  return (
    <ReactFlow
      key={resetKey}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      onPaneClick={() => onSelectionChange(null)}
      defaultEdgeOptions={{ type: "smoothstep" }}
      fitView
      fitViewOptions={{ padding: 0.16, minZoom: 0.3, maxZoom: 1 }}
      minZoom={0.25}
      maxZoom={1.5}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#dce4de" />
      <Controls position="bottom-left" showInteractive={false} />
    </ReactFlow>
  );
}

export function ArchitectureCanvas({
  onSelectionChange,
  resetKey,
  architectureServices,
  architectureTitle,
}: {
  onSelectionChange: (data: ServiceData | null) => void;
  resetKey: number;
  architectureServices: ArchitectureService[] | null;
  architectureTitle: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-[84px] items-center justify-between gap-4 border-b border-[#e7ebe8] bg-white px-6 py-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#849189]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#54a477]" />
            Architecture canvas
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[18px] font-semibold tracking-[-0.04em] text-[#1f2c25]">
              {architectureTitle}
            </h1>
            {!architectureServices && (
              <span className="rounded-md border border-[#e6ebe7] bg-[#fafcfb] px-2 py-1 text-[10px] font-medium text-[#718078]">
                AWS · us-east-1
              </span>
            )}
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-lg border border-[#e7ebe8] bg-[#fbfcfb] px-3 py-2 sm:flex">
          <Activity size={14} className="text-[#639578]" />
          <span className="text-[10px] font-medium text-[#77847c]">
            {architectureServices?.length ?? 6} services
          </span>
        </div>
      </div>
      <div className="canvas-grid relative min-h-[520px] flex-1">
        <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-lg border border-[#e8ede9] bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm">
          <Layers3 size={13} className="text-[#6f8979]" />
          <span className="text-[10px] font-medium text-[#6b7971]">
            Drag nodes to rearrange
          </span>
        </div>
        <ReactFlowProvider>
          <CanvasContent
            onSelectionChange={onSelectionChange}
            resetKey={resetKey}
            architectureServices={architectureServices}
          />
        </ReactFlowProvider>
        <div className="pointer-events-none absolute bottom-5 right-5 z-10 hidden items-center gap-2 rounded-lg border border-[#e8ede9] bg-white/90 px-3 py-2 text-[10px] text-[#829087] shadow-sm md:flex">
          <ShieldCheck size={13} className="text-[#5d9b78]" />
          {architectureServices ? "Generated design draft" : "Production-ready blueprint"}
          <Cloud size={13} className="ml-1 text-[#88a190]" />
          <Server size={13} className="text-[#88a190]" />
        </div>
      </div>
      <div className="flex h-10 items-center justify-between border-t border-[#e7ebe8] bg-white px-6">
        <span className="text-[10px] text-[#8b9790]">
          {architectureTitle} · {architectureServices?.length ?? 6} resources
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#668673]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5eac7e]" />
          {architectureServices ? "Visualization only" : "All systems operational"}
        </span>
      </div>
    </div>
  );
}

export { nodeDescriptions };
export type { ServiceData };
