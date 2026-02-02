import { Code, Eye, TestTube, Building2, FileText, Bug, type LucideIcon } from 'lucide-react';

export interface RoleConfig {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
  borderColor: string;
  bgColor: string;
  description: string;
}

export const roleConfigs: Record<string, RoleConfig> = {
  coder: {
    value: 'coder',
    label: 'Coder',
    icon: Code,
    color: 'text-blue-700',
    borderColor: 'border-blue-400',
    bgColor: 'bg-blue-100',
    description: 'Software developer - writes clean, efficient code',
  },
  reviewer: {
    value: 'reviewer',
    label: 'Reviewer',
    icon: Eye,
    color: 'text-purple-700',
    borderColor: 'border-purple-400',
    bgColor: 'bg-purple-100',
    description: 'Code reviewer - analyzes code for issues and improvements',
  },
  tester: {
    value: 'tester',
    label: 'Tester',
    icon: TestTube,
    color: 'text-green-700',
    borderColor: 'border-green-400',
    bgColor: 'bg-green-100',
    description: 'QA engineer - writes tests and identifies edge cases',
  },
  architect: {
    value: 'architect',
    label: 'Architect',
    icon: Building2,
    color: 'text-orange-700',
    borderColor: 'border-orange-400',
    bgColor: 'bg-orange-100',
    description: 'Software architect - designs systems and provides guidance',
  },
  docs: {
    value: 'docs',
    label: 'Docs',
    icon: FileText,
    color: 'text-yellow-700',
    borderColor: 'border-yellow-400',
    bgColor: 'bg-yellow-100',
    description: 'Technical writer - creates documentation and explanations',
  },
  debugger: {
    value: 'debugger',
    label: 'Debugger',
    icon: Bug,
    color: 'text-red-700',
    borderColor: 'border-red-400',
    bgColor: 'bg-red-100',
    description: 'Debugging specialist - finds and fixes bugs',
  },
};

export const roleOptions = Object.values(roleConfigs);

export function getRoleConfig(role: string | null | undefined): RoleConfig {
  if (!role || !roleConfigs[role]) {
    return roleConfigs.coder;
  }
  return roleConfigs[role];
}

export function getRoleIcon(role: string | null | undefined): LucideIcon {
  return getRoleConfig(role).icon;
}

export function getRoleColor(role: string | null | undefined): string {
  return getRoleConfig(role).color;
}

export function getRoleBgColor(role: string | null | undefined): string {
  return getRoleConfig(role).bgColor;
}

export function getRoleBorderColor(role: string | null | undefined): string {
  return getRoleConfig(role).borderColor;
}
