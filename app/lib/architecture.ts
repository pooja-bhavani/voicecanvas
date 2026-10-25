export type ServiceKind =
  | "internet"
  | "cdn"
  | "gateway"
  | "service"
  | "worker"
  | "stream"
  | "database"
  | "cache";

export type ArchitectureService = {
  name: string;
  kind: ServiceKind;
  description: string;
};

export type ArchitectureResult = {
  title: string;
  summary: string;
  notes: string[];
  services: ArchitectureService[];
  terraform: string;
  compose: string;
  source: "gemini" | "local";
};
