import { Code, Eye, TestTube, Building2, FileText, Bug, type LucideIcon } from 'lucide-react';

export interface RoleConfig {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
  borderColor: string;
  bgColor: string;
  description: string;
  promptDescription: string;
  outputInstruction: string;
}

/**
 * Unified role definitions - single source of truth for all role-related data.
 * Used by: AgentNode, promptBuilder, store roleDefinitions
 */
export const roleConfigs: Record<string, RoleConfig> = {
  coder: {
    value: 'coder',
    label: 'Coder',
    icon: Code,
    color: 'text-blue-700',
    borderColor: 'border-blue-400',
    bgColor: 'bg-blue-100',
    description: 'Software developer - writes clean, efficient code',
    promptDescription: 'You are a software developer. Write clean, efficient code.',
    outputInstruction: 'Respond with working code.',
  },
  reviewer: {
    value: 'reviewer',
    label: 'Reviewer',
    icon: Eye,
    color: 'text-purple-700',
    borderColor: 'border-purple-400',
    bgColor: 'bg-purple-100',
    description: 'Code reviewer - analyzes code for issues and improvements',
    promptDescription: 'You are a code reviewer. Analyze code for issues, suggest improvements, and identify potential bugs.',
    outputInstruction: 'Provide detailed code review feedback.',
  },
  tester: {
    value: 'tester',
    label: 'Tester',
    icon: TestTube,
    color: 'text-green-700',
    borderColor: 'border-green-400',
    bgColor: 'bg-green-100',
    description: 'QA engineer - writes tests and identifies edge cases',
    promptDescription: 'You are a QA engineer. Write comprehensive tests and identify edge cases.',
    outputInstruction: 'Respond with test cases and testing strategies.',
  },
  architect: {
    value: 'architect',
    label: 'Architect',
    icon: Building2,
    color: 'text-orange-700',
    borderColor: 'border-orange-400',
    bgColor: 'bg-orange-100',
    description: 'Software architect - designs systems and provides guidance',
    promptDescription: 'You are a software architect. Design systems, define patterns, and provide high-level technical guidance.',
    outputInstruction: 'Provide architectural recommendations and design decisions.',
  },
  docs: {
    value: 'docs',
    label: 'Docs Writer',
    icon: FileText,
    color: 'text-yellow-700',
    borderColor: 'border-yellow-400',
    bgColor: 'bg-yellow-100',
    description: 'Technical writer - creates documentation and explanations',
    promptDescription: 'You are a technical writer. Create clear, comprehensive documentation and explanations.',
    outputInstruction: 'Respond with well-structured documentation.',
  },
  debugger: {
    value: 'debugger',
    label: 'Debugger',
    icon: Bug,
    color: 'text-red-700',
    borderColor: 'border-red-400',
    bgColor: 'bg-red-100',
    description: 'Debugging specialist - finds and fixes bugs',
    promptDescription: 'You are a debugging specialist. Analyze issues, find root causes, and fix bugs.',
    outputInstruction: 'Identify the problem and provide a fix.',
  },
};

export const roleOptions = Object.values(roleConfigs);

/**
 * Get role prompt description (for building prompts)
 */
export function getRolePromptDescription(role: string | null | undefined): string {
  if (!role || !roleConfigs[role]) {
    return roleConfigs.coder.promptDescription;
  }
  return roleConfigs[role].promptDescription;
}

/**
 * Get role output instruction (for building prompts)
 */
export function getRoleOutputInstruction(role: string | null | undefined): string {
  if (!role || !roleConfigs[role]) {
    return roleConfigs.coder.outputInstruction;
  }
  return roleConfigs[role].outputInstruction;
}

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
