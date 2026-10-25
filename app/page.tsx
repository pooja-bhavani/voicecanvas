"use client";

import {
  ArrowUp,
  Check,
  ChevronDown,
  Clipboard,
  Cloud,
  Download,
  FileCode2,
  FileText,
  LoaderCircle,
  Mic2,
  RotateCcw,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ArchitectureCanvas, nodeDescriptions, type ServiceData } from "./architecture-canvas";
import type {
  ArchitectureResult,
  ArchitectureService,
} from "./lib/architecture";

type InspectorTab = "summary" | "terraform" | "compose";

const tabLabels: Record<InspectorTab, string> = {
  summary: "Overview",
  terraform: "main.tf",
  compose: "docker-compose.yml",
};

const sampleTerraform = `terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region for the payments platform"
  type        = string
  default     = "us-east-1"
}

variable "db_password" {
  description = "Master password supplied securely at deploy time"
  type        = string
  sensitive   = true
}

variable "redis_auth_token" {
  description = "Redis AUTH token supplied securely at deploy time (minimum 16 characters)"
  type        = string
  sensitive   = true
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "payments-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "payments-igw" }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags                    = { Name = "payments-public-\${count.index + 1}" }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = { Name = "payments-private-\${count.index + 1}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "payments-public" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_eip" "nat" {
  count  = 2
  domain = "vpc"
  tags   = { Name = "payments-nat-\${count.index + 1}" }
}

resource "aws_nat_gateway" "main" {
  count         = 2
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  depends_on    = [aws_internet_gateway.main]
  tags          = { Name = "payments-nat-\${count.index + 1}" }
}

resource "aws_route_table" "private" {
  count  = 2
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }
  tags = { Name = "payments-private-\${count.index + 1}" }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_security_group" "database" {
  name        = "payments-database"
  description = "PostgreSQL access from application services only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from application tier"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.application.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "payments-database" }
}

resource "aws_security_group" "application" {
  name        = "payments-application"
  description = "Application service network access"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "payments-application" }
}

resource "aws_db_subnet_group" "main" {
  name       = "payments-db"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "payments-db" }
}

resource "aws_db_instance" "postgres" {
  identifier                  = "payments-postgres"
  engine                      = "postgres"
  engine_version              = "16.4"
  instance_class              = "db.t4g.medium"
  allocated_storage           = 100
  max_allocated_storage       = 500
  storage_type                = "gp3"
  storage_encrypted           = true
  db_name                     = "payments"
  username                    = "app_admin"
  password                    = var.db_password
  db_subnet_group_name        = aws_db_subnet_group.main.name
  vpc_security_group_ids      = [aws_security_group.database.id]
  multi_az                    = true
  backup_retention_period     = 14
  deletion_protection         = true
  auto_minor_version_upgrade  = true
  copy_tags_to_snapshot       = true
  performance_insights_enabled = true
  skip_final_snapshot         = false
  final_snapshot_identifier   = "payments-postgres-final"
  tags                        = { Name = "payments-postgres" }
}

resource "aws_ecs_cluster" "main" {
  name = "payments"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = { Name = "payments" }
}

resource "aws_security_group" "cache" {
  name        = "payments-cache"
  description = "Redis access from application services only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from application tier"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.application.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "payments-cache" }
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "payments-cache"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "payments-cache" }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "payments-cache"
  description                = "Multi-AZ Redis cache for the payments platform"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = "cache.t4g.small"
  num_cache_clusters         = 2
  parameter_group_name       = "default.redis7"
  port                       = 6379
  auth_token                 = var.redis_auth_token
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.cache.id]
  automatic_failover_enabled = true
  multi_az_enabled           = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  apply_immediately          = false
  auto_minor_version_upgrade = true
  tags                       = { Name = "payments-cache" }
}

output "vpc_id" {
  description = "VPC hosting the payments platform"
  value       = aws_vpc.main.id
}

output "database_endpoint" {
  description = "Private PostgreSQL endpoint"
  value       = aws_db_instance.postgres.address
}

output "redis_primary_endpoint" {
  description = "Private, TLS-enabled Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}`;

const sampleCompose = `name: payments-platform

services:
  gateway:
    image: nginx:1.27-alpine
    ports:
      - "8080:8080"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      auth-service:
        condition: service_healthy
      orders-service:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - frontend
      - backend
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 5s
      retries: 3

  auth-service:
    image: ghcr.io/your-org/payments-auth:latest
    environment:
      NODE_ENV: production
      PORT: "3001"
      DATABASE_URL: \${AUTH_DATABASE_URL:?Set AUTH_DATABASE_URL}
      REDIS_URL: redis://cache:6379
    depends_on:
      database:
        condition: service_healthy
      cache:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - backend
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 20s

  orders-service:
    image: ghcr.io/your-org/payments-orders:latest
    environment:
      NODE_ENV: production
      PORT: "3002"
      DATABASE_URL: \${ORDERS_DATABASE_URL:?Set ORDERS_DATABASE_URL}
      REDIS_URL: redis://cache:6379
    depends_on:
      database:
        condition: service_healthy
      cache:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - backend
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3002/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 20s

  database:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: payments
      POSTGRES_USER: app_admin
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $\${POSTGRES_USER} -d $\${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  cache:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - backend
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
  redis_data:

networks:
  frontend:
  backend:
    internal: true`;

function generateBrowserFallback(input: string): ArchitectureResult {
  const words = input.trim().replace(/\s+/g, " ").split(" ");
  const meaningfulWords = words.filter(
    (word) => !/^(build|create|design|make|deploy|architecture|infrastructure|for|a|an|the|with)$/i.test(word),
  );
  const fintechPaymentRequest =
    /fintech/i.test(input) &&
    /cloudfront/i.test(input) &&
    /\balb\b|application load balancer/i.test(input) &&
    /kafka/i.test(input) &&
    /fraud/i.test(input) &&
    /aurora/i.test(input);
  const title = fintechPaymentRequest
    ? "Fintech Payment Processing"
    : meaningfulWords
        .slice(0, 5)
        .map((word) => word[0]?.toUpperCase() + word.slice(1))
        .join(" ") || "New Cloud Architecture";
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "new-architecture";
  const lowerInput = input.toLowerCase();
  const services: ArchitectureService[] = fintechPaymentRequest
    ? [
        { name: "CloudFront", kind: "cdn", description: "Global HTTPS edge distribution" },
        { name: "Application Load Balancer", kind: "gateway", description: "Routes traffic to authentication and payment services" },
        { name: "Authentication service", kind: "service", description: "Validates payment users and sessions" },
        { name: "Payment-processing service", kind: "service", description: "Processes transactions and publishes events" },
        { name: "Apache Kafka", kind: "stream", description: "Asynchronous transaction event streaming" },
        { name: "Fraud-detection worker", kind: "worker", description: "Consumes payment events for fraud analysis" },
        { name: "Aurora PostgreSQL", kind: "database", description: "Highly available transaction data store" },
        { name: "Redis cluster", kind: "cache", description: "Session cache for authentication" },
      ]
    : [
        {
          name: "Internet",
          kind: "internet",
          description: "Public HTTPS traffic",
        },
        {
          name: "API Gateway",
          kind: "gateway",
          description: "Routes and protects incoming requests",
        },
      ];
  const applicationOptions: Array<[RegExp, string, string]> = [
    [/auth|identity|login|user service/, "Authentication service", "Authentication and user identity"],
    [/frontend|website|web app|portal/, "Web application", "Customer-facing web application"],
    [/worker|background|queue|async/, "Background worker", "Asynchronous task processing"],
    [/payment|checkout|billing/, "Payment-processing service", "Payment and checkout processing"],
    [/notification|email|messaging/, "Notification service", "Event-driven customer notifications"],
    [/order|commerce|shopping/, "Orders service", "Order processing and fulfillment"],
    [/api|microservice|backend/, "Application service", "Stateless application API"],
  ];
  const matchedApplication = applicationOptions
    .filter(([pattern]) => pattern.test(lowerInput))
    .map(([, name, description]) => ({ name, kind: "service" as const, description }));
  services.push(
    ...(matchedApplication.length > 0
      ? matchedApplication.slice(0, 4)
      : [{ name: "Application service", kind: "service" as const, description: "Stateless application API" }]),
  );

  if (/postgres|mysql|database|sql|rds|relational/.test(lowerInput)) {
    services.push({
      name: /mysql/.test(lowerInput) ? "MySQL database" : "PostgreSQL database",
      kind: "database",
      description: "Managed relational database in a private network",
    });
  }
  if (/redis|cache|caching|low.latency/.test(lowerInput)) {
    services.push({
      name: "Redis cache",
      kind: "cache",
      description: "Private in-memory cache for low-latency reads",
    });
  }
  if (!services.some((service) => service.kind === "database")) {
    services.push({
      name: "PostgreSQL database",
      kind: "database",
      description: "Managed relational database in a private network",
    });
  }
  if (!services.some((service) => service.kind === "cache")) {
    services.push({
      name: "Redis cache",
      kind: "cache",
      description: "Private in-memory cache for low-latency reads",
    });
  }

  const spokenNotes = input
    .split(/(?<=[.!?])\s+|\n+/)
    .map((note) => note.trim())
    .filter(Boolean)
    .flatMap((sentence) => {
      const chunks: string[] = [];
      for (let offset = 0; offset < sentence.length; offset += 900) {
        chunks.push(sentence.slice(offset, offset + 900));
      }
      return chunks;
    });
  const notes = [
    ...spokenNotes,
    "Keep data services private and inject credentials from environment variables.",
    "Enable health checks, encrypted storage, and multi-zone availability.",
  ].slice(0, 12);
  const safeNotes = notes.map((note) => note.replace(/[\r\n]/g, " ").slice(0, 1_000));
  const noteComments = safeNotes.map((note) => `# ${note}`).join("\n");
  const composeComments = safeNotes.map((note) => `# ${note}`).join("\n");

  return {
    title,
    summary: `Local draft based on your request: ${input.trim().slice(0, 300)}`,
    notes: safeNotes,
    services,
    terraform: sampleTerraform
      .replaceAll("payments", slug)
      .replace("terraform {", `${noteComments}\n\nterraform {`),
    compose: sampleCompose
      .replace(/^name: payments-platform/m, `name: ${slug}-platform`)
      .replace(/^name: [^\n]+/m, (name) => `${name}\n${composeComments}`),
    source: "local",
  };
}

function CodeBlock({ source }: { source: string }) {
  const lines = source.split("\n");

  return (
    <pre className="min-w-0 overflow-x-auto pb-8 text-[11px] leading-[1.75] text-[#c1d0c6]">
      <code>
        {lines.map((line, index) => (
          <span className="flex min-w-max" key={`${index}-${line}`}>
            <span className="sticky left-0 mr-5 inline-block w-7 shrink-0 select-none bg-[#111916] pr-2 text-right text-[#56645c]">
              {index + 1}
            </span>
            <span className="whitespace-pre">{line || " "}</span>
          </span>
        ))}
      </code>
    </pre>
  );
}

function Summary({
  selectedNode,
  architecture,
}: {
  selectedNode: ServiceData | null;
  architecture: ArchitectureResult | null;
}) {
  const detail = selectedNode
    ? selectedNode.description || nodeDescriptions[selectedNode.kind]
    : architecture?.summary ??
      "A resilient, multi-AZ payments platform with independently scalable services, private data tiers, and encrypted traffic.";
  const serviceCount = architecture?.services.filter((service) => service.kind === "service").length ?? 2;
  const databaseCount = architecture?.services.filter((service) => service.kind === "database").length ?? 1;
  const cacheCount = architecture?.services.filter((service) => service.kind === "cache").length ?? 1;

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-4">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#214d39] text-[#88d6a7]">
            {selectedNode ? <Cloud size={17} /> : <Sparkles size={17} />}
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-[#173d2c] px-2.5 py-1 text-[9px] font-medium text-[#86d0a1]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#68c88c]" />
            {selectedNode ? selectedNode.kind : architecture ? `${architecture.source} draft` : "Architecture ready"}
          </span>
        </div>
        <h2 className="text-[16px] font-semibold tracking-[-0.03em] text-[#eef5f0]">
          {selectedNode?.title ?? architecture?.title ?? "Payments platform"}
        </h2>
        <p className="mt-2 text-[11px] leading-[1.7] text-[#9baaa0]">{detail}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(selectedNode
            ? [selectedNode.subtitle, architecture ? "Generated service" : "AWS · us-east-1"]
            : architecture
              ? [`${architecture.services.length} components`, "Generated architecture"]
              : ["AWS · us-east-1", "High availability", "Private networking"]
          ).map((label) => (
            <span
              key={label}
              className="rounded-md border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[9px] text-[#a5b2a9]"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#89988e]">
            System at a glance
          </h3>
          <span className="text-[9px] text-[#65736a]">
            {architecture?.services.length ?? 6} components
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            [String(serviceCount).padStart(2, "0"), "Services"],
            [String(databaseCount).padStart(2, "0"), "Database"],
            [String(cacheCount).padStart(2, "0"), "Cache"],
          ].map(([value, label]) => (
            <div
              key={label}
              className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-3"
            >
              <div className="text-[18px] font-semibold tracking-[-0.04em] text-[#e4eee7]">
                {value}
              </div>
              <div className="mt-1 text-[9px] text-[#819087]">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {architecture && (
        <section>
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#89988e]">
            Speaker notes
          </h3>
          <ul className="space-y-2">
            {architecture.notes.map((note, index) => (
              <li key={`${index}-${note}`} className="flex gap-2 text-[10px] leading-[1.6] text-[#a8b5ac]">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#6eb78b]" />
                {note}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#89988e]">
          Built for production
        </h3>
        <div className="space-y-3">
          {[
            ["Multi-AZ by default", "Redundant subnets and managed database failover."],
            ["Private data layer", "Database and cache stay off the public internet."],
            ["Secure foundations", "Encrypted storage, scoped access, and health checks."],
          ].map(([title, body]) => (
            <div key={title} className="flex gap-2.5">
              <div className="mt-0.5 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full bg-[#173d2c] text-[#83c99d]">
                <Check size={10} strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-[10px] font-medium text-[#d2ddd5]">{title}</div>
                <div className="mt-1 text-[9px] leading-[1.6] text-[#849188]">{body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-2 rounded-lg border border-[#244633] bg-[#173426]/55 px-3 py-2.5">
        <Shield size={14} className="shrink-0 text-[#77c492]" />
        <p className="text-[9px] leading-[1.5] text-[#a0b8a7]">
          Credentials are injected at deploy time — never stored in source.
        </p>
      </div>
    </div>
  );
}

function Inspector({
  selectedNode,
  architecture,
}: {
  selectedNode: ServiceData | null;
  architecture: ArchitectureResult | null;
}) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("summary");
  const [feedback, setFeedback] = useState("");
  const source =
    activeTab === "terraform"
      ? architecture?.terraform ?? sampleTerraform
      : architecture?.compose ?? sampleCompose;
  const filename = activeTab === "terraform" ? "main.tf" : "docker-compose.yml";
  const lineCount = useMemo(() => source.split("\n").length, [source]);

  const copySource = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(source);
      setFeedback("Copied to clipboard");
    } catch (error) {
      console.error("Unable to copy configuration", error);
      setFeedback("Copy failed — allow clipboard access and try again");
    }
    window.setTimeout(() => setFeedback(""), 2800);
  }, [source]);

  const downloadSource = useCallback(() => {
    const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setFeedback(`${filename} downloaded`);
    window.setTimeout(() => setFeedback(""), 2800);
  }, [filename, source]);

  return (
    <aside className="flex min-h-[620px] min-w-0 flex-col bg-[#111916] text-white lg:min-h-0">
      <div className="border-b border-white/[0.08] px-5 pt-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#809087]">
              Inspector
            </div>
            <div className="mt-1 text-[13px] font-medium text-[#edf4ef]">
              Architecture details
            </div>
          </div>
          <button
            type="button"
            aria-label="Close inspector details"
            onClick={() => setActiveTab("summary")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#7f8d84] transition hover:bg-white/[0.08] hover:text-white"
          >
            <X size={15} />
          </button>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {(["summary", "terraform", "compose"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setFeedback("");
              }}
              className={`relative flex shrink-0 items-center gap-1.5 px-2.5 py-2.5 text-[10px] transition ${
                activeTab === tab
                  ? "text-[#a5e0b9]"
                  : "text-[#849188] hover:text-[#c9d4cc]"
              }`}
            >
              {tab === "summary" ? (
                <FileText size={12} />
              ) : (
                <FileCode2 size={12} />
              )}
              {tabLabels[tab]}
              {activeTab === tab && (
                <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[#72c48e]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "summary" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Summary selectedNode={selectedNode} architecture={architecture} />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#24332a] text-[#a3d9b4]">
                <FileCode2 size={12} />
              </span>
              <span className="truncate text-[10px] font-medium text-[#d4ded7]">
                {filename}
              </span>
              <span className="hidden rounded bg-white/[0.06] px-1.5 py-0.5 text-[8px] text-[#809087] sm:inline">
                {lineCount} lines
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={copySource}
                className="flex items-center gap-1.5 rounded-md border border-white/[0.1] px-2.5 py-1.5 text-[9px] font-medium text-[#bfcbc2] transition hover:border-[#59876b] hover:bg-[#1d3025] hover:text-white"
              >
                <Clipboard size={11} />
                Copy
              </button>
              <button
                type="button"
                onClick={downloadSource}
                className="flex items-center gap-1.5 rounded-md bg-[#367b54] px-2.5 py-1.5 text-[9px] font-medium text-white transition hover:bg-[#408f62]"
              >
                <Download size={11} />
                Download
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-3 pt-4">
            <CodeBlock source={source} />
          </div>
          {feedback && (
            <div
              role="status"
              className={`border-t border-white/[0.07] px-5 py-2 text-[10px] ${
                feedback.includes("failed") ? "text-[#f2a49b]" : "text-[#9bd1a9]"
              }`}
            >
              {feedback}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-white/[0.07] px-5 py-3">
            <span className="text-[9px] text-[#75837a]">
              {architecture ? "Generated draft · review before applying" : "Ready to export"}
            </span>
            <span className="flex items-center gap-1.5 text-[9px] text-[#8d9a91]">
              <span className={`h-1.5 w-1.5 rounded-full ${architecture ? "bg-[#d4ad68]" : "bg-[#68bd86]"}`} />
              {architecture ? "Review before deploy" : "Sample configuration"}
            </span>
          </div>
        </>
      )}
    </aside>
  );
}

export default function Home() {
  const [resetKey, setResetKey] = useState(0);
  const [selectedNode, setSelectedNode] = useState<ServiceData | null>(null);
  const [sampleNotice, setSampleNotice] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [architecture, setArchitecture] = useState<ArchitectureResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");

  const generateArchitecture = useCallback(
    async () => {
      const spokenInput = prompt.trim();
      if (!spokenInput || isGenerating) return;

      setIsGenerating(true);
      setGenerationStatus("Turning your speaker notes into an architecture…");
      setSelectedNode(null);

      try {
        const response = await fetch("/api/architecture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: spokenInput }),
        });
        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => null);
          const error =
            typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof payload.error === "string"
              ? payload.error
              : `Architecture service returned ${response.status}`;
          const code =
            typeof payload === "object" &&
            payload !== null &&
            "code" in payload &&
            typeof payload.code === "string"
              ? payload.code
              : "";
          const retryAfterSeconds =
            typeof payload === "object" &&
            payload !== null &&
            "retryAfterSeconds" in payload &&
            typeof payload.retryAfterSeconds === "number"
              ? payload.retryAfterSeconds
              : null;
          throw Object.assign(new Error(error), { code, retryAfterSeconds });
        }
        const result = (await response.json()) as Omit<ArchitectureResult, "source"> & {
          source?: "gemini";
        };
        setArchitecture({ ...result, source: "gemini" });
        setGenerationStatus("Architecture and configuration generated with Gemini.");
      } catch (error) {
        setArchitecture(generateBrowserFallback(spokenInput));
        const code =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof error.code === "string"
            ? error.code
            : "";
        const providerMessage =
          error instanceof Error ? error.message : "Gemini couldn't generate a response.";
        setGenerationStatus(
          code === "DAILY_QUOTA_EXCEEDED"
            ? `${providerMessage} Your notes are preserved in a browser draft.`
            : code === "OUTPUT_LIMIT"
            ? "Gemini's reply was cut off — your full notes are shown in a browser-generated draft."
            : code === "NOT_CONFIGURED"
              ? "Gemini isn't configured — your notes are shown in a browser-generated draft."
              : code === "INVALID_API_KEY"
                ? "Gemini rejected the API key — check .env.local. Your notes are preserved in a browser draft."
                : code === "RATE_LIMITED"
                  ? "Gemini is rate-limited — wait a moment and retry. Your notes are preserved in a browser draft."
                  : code === "TEMPORARY_PROVIDER_ERROR"
                    ? "Gemini is temporarily unavailable — retry in a moment. Your notes are preserved in a browser draft."
              : `${providerMessage} Your notes are preserved in a browser draft.`,
        );
      } finally {
        setResetKey((key) => key + 1);
        setIsGenerating(false);
      }
    },
    [isGenerating, prompt],
  );

  const loadSampleArchitecture = useCallback(() => {
    setResetKey((key) => key + 1);
    setSelectedNode(null);
    setArchitecture(null);
    setPrompt("");
    setGenerationStatus("");
    setSampleNotice(true);
    window.setTimeout(() => setSampleNotice(false), 2400);
  }, []);

  return (
    <main className="flex min-h-screen flex-col">
      <header className="relative z-20 flex min-h-[68px] items-center justify-between border-b border-[#e8ece9] bg-white px-4 sm:px-6">
        <a href="#" className="flex items-center gap-3" aria-label="Voice Canvas home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1f7653] text-white shadow-[0_4px_10px_rgba(31,118,83,0.2)]">
            <Mic2 size={17} strokeWidth={2} />
          </span>
          <span>
            <span className="block text-[14px] font-semibold tracking-[-0.04em] text-[#1e2a23]">
              voice<span className="text-[#398260]">canvas</span>
            </span>
            <span className="hidden text-[9px] text-[#89948d] sm:block">
              Cloud architecture, clearly.
            </span>
          </span>
        </a>

        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-[#e8ede9] bg-[#fbfcfb] px-3 py-1.5 md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5aa77a]" />
          <span className="text-[10px] font-medium text-[#78867d]">Untitled architecture</span>
          <ChevronDown size={12} className="text-[#98a39c]" />
        </div>

        <button
          type="button"
          onClick={loadSampleArchitecture}
          className="flex items-center gap-2 rounded-lg border border-[#dce8df] bg-white px-3 py-2 text-[10px] font-semibold text-[#347752] shadow-sm transition hover:border-[#b9d2c0] hover:bg-[#f4faf5] sm:px-3.5 sm:text-[11px]"
        >
          <RotateCcw size={13} />
          <span className="hidden sm:inline">Try Sample Architecture</span>
          <span className="sm:hidden">Try sample</span>
        </button>
      </header>

      <section className="border-b border-[#e7ebe8] bg-[#f8faf8] px-4 py-5 sm:px-6 sm:py-6">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void generateArchitecture();
          }}
          className="mx-auto max-w-[1180px] rounded-2xl border border-[#e3e9e4] bg-white p-4 shadow-[0_6px_24px_rgba(31,56,41,0.045)] sm:p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#eaf5ed] text-[#367b54]">
              <Mic2 size={14} />
            </span>
            <label
              htmlFor="speaker-notes"
              className="text-[13px] font-semibold tracking-[-0.02em] text-[#26352d]"
            >
              Speaker Cloud Infrastructure
            </label>
          </div>
          <textarea
            id="speaker-notes"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void generateArchitecture();
              }
            }}
            maxLength={6000}
            rows={3}
            placeholder="Describe the cloud infrastructure you have in mind…"
            className="min-h-[92px] w-full resize-y rounded-xl border border-[#e7ece8] bg-[#fbfcfb] px-4 py-3 text-[13px] leading-6 text-[#27372e] outline-none transition placeholder:text-[#a1aca5] focus:border-[#93bda0] focus:bg-white focus:ring-4 focus:ring-[#eaf5ed]"
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] leading-5 text-[#829087]">
              Hold the <kbd className="rounded border border-[#dfe6e0] bg-[#f7f9f7] px-1.5 py-0.5 font-sans text-[9px] text-[#5d6c62]">Function</kbd> key while speaking with Wispr Flow; release it to insert your notes. Press <kbd className="rounded border border-[#dfe6e0] bg-[#f7f9f7] px-1.5 py-0.5 font-sans text-[9px] text-[#5d6c62]">⌘/Ctrl + Enter</kbd> to submit. Sent to Gemini, so leave out credentials.
            </p>
            <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
              <span
                role="status"
                aria-live="polite"
                className={`max-w-[300px] text-[10px] ${
                  generationStatus.includes("unavailable") ? "text-[#8a7552]" : "text-[#74847a]"
                }`}
              >
                {generationStatus}
              </span>
              <button
                type="submit"
                disabled={isGenerating || !prompt.trim()}
                className="flex items-center gap-2 rounded-lg bg-[#26734d] px-4 py-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#1f6442] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <ArrowUp size={14} />
                )}
                {isGenerating ? "Generating…" : "Generate architecture"}
              </button>
            </div>
          </div>
        </form>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="flex min-h-[680px] min-w-0 flex-col lg:min-h-0">
          <ArchitectureCanvas
            onSelectionChange={setSelectedNode}
            resetKey={resetKey}
            architectureServices={architecture?.services ?? null}
            architectureTitle={architecture?.title ?? "Payments platform"}
          />
        </section>
        <Inspector selectedNode={selectedNode} architecture={architecture} />
      </div>

      {sampleNotice && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[#d8e8dc] bg-white px-4 py-2.5 text-[11px] font-medium text-[#367752] shadow-lg"
        >
          Sample architecture loaded
        </div>
      )}
    </main>
  );
}
