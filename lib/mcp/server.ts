import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { logMcpInvocation } from './audit';
import type { McpRequestContext } from './auth';
import {
  getLeadRecoveryReplies,
  getLeadRecoveryStats,
  getLeadRecoveryStatus,
  listLeadRecoveryProspects,
} from '@/lib/tools/lead-recovery/service';
import {
  getYouTubeReplies,
  getYouTubeStats,
  getYouTubeStatus,
  listYouTubeCreators,
} from '@/lib/tools/youtube-outreach/service';
import { youtubeCreatorStatuses } from '@/lib/tools/youtube-outreach/types';

const leadStatuses = ['new', 'processing', 'approved', 'contacted', 'rejected', 'suppressed', 'bounced', 'unsubscribed', 'replied'] as const;
const countMap = z.record(z.string(), z.number());
const recordList = z.array(z.record(z.string(), z.unknown()));
const oauthSecuritySchemes = [{ type: 'oauth2', scopes: ['openid', 'profile', 'email'] }] as const;
const readOnlyToolMeta = { securitySchemes: oauthSecuritySchemes };

async function audited<T>(context: McpRequestContext, toolName: string, operation: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await operation();
    await logMcpInvocation({ context, toolName, success: true, durationMs: performance.now() - startedAt });
    return result;
  } catch (error) {
    await logMcpInvocation({
      context,
      toolName,
      success: false,
      durationMs: performance.now() - startedAt,
      errorCode: error instanceof Error ? error.name : 'unknown_error',
    });
    throw error;
  }
}

function result<T extends Record<string, unknown>>(summary: string, structuredContent: T) {
  return { structuredContent, content: [{ type: 'text' as const, text: summary }] };
}

export function createAurionStackMcpServer(context: McpRequestContext) {
  const server = new McpServer(
    { name: 'aurionstack-automation-hub', version: '2.0.0' },
    {
      instructions: 'Read-only access to the authenticated user’s AurionStack workspace. Never infer missing records or claim that an action was taken. No campaign activation, scraping, queueing, or outreach tools are exposed.',
    },
  );
  const readOnlyAnnotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

  server.registerTool('lead_recovery.get_status', {
    title: 'Get Lead Recovery status',
    description: 'Use this when the user asks whether Lead Recovery is active, paused, configured, or has queued or failed work.',
    inputSchema: {},
    outputSchema: {
      active: z.boolean(), activeTargets: z.number(), totalTargets: z.number(), leadCounts: countMap,
      queueCounts: countMap, senderReady: z.boolean(), lastActivityAt: z.string().nullable(),
    },
    annotations: readOnlyAnnotations,
    _meta: readOnlyToolMeta,
  }, async () => {
    const status = await audited(context, 'lead_recovery.get_status', () => getLeadRecoveryStatus(context));
    return result(status.active ? 'Lead Recovery is active.' : 'Lead Recovery is paused.', status);
  });

  server.registerTool('lead_recovery.list_prospects', {
    title: 'List Lead Recovery prospects',
    description: 'Use this when the user wants to review tenant-scoped company prospects and their qualification details.',
    inputSchema: {
      statuses: z.array(z.enum(leadStatuses)).max(9).optional(),
      minScore: z.number().int().min(0).max(100).optional(),
      limit: z.number().int().min(1).max(100).default(25),
    },
    outputSchema: { prospects: recordList, count: z.number() },
    annotations: readOnlyAnnotations,
    _meta: readOnlyToolMeta,
  }, async (input) => {
    const prospects = await audited(context, 'lead_recovery.list_prospects', () => listLeadRecoveryProspects(context, input));
    return result(`Found ${prospects.length} Lead Recovery prospects.`, { prospects, count: prospects.length });
  });

  server.registerTool('lead_recovery.get_replies', {
    title: 'Get Lead Recovery replies',
    description: 'Use this when the user asks for recent replies to Lead Recovery outreach.',
    inputSchema: { limit: z.number().int().min(1).max(100).default(25) },
    outputSchema: { replies: recordList, count: z.number() },
    annotations: readOnlyAnnotations,
    _meta: readOnlyToolMeta,
  }, async ({ limit }) => {
    const replies = await audited(context, 'lead_recovery.get_replies', () => getLeadRecoveryReplies(context, limit));
    return result(`Found ${replies.length} Lead Recovery replies.`, { replies, count: replies.length });
  });

  server.registerTool('lead_recovery.get_stats', {
    title: 'Get Lead Recovery statistics',
    description: 'Use this when the user asks for Lead Recovery pipeline, delivery, or engagement metrics.',
    inputSchema: {},
    outputSchema: {
      prospects: z.number(), qualified: z.number(), contacted: z.number(), replied: z.number(), sent: z.number(),
      sentToday: z.number(), pending: z.number(), failed: z.number(), delivered: z.number(), opened: z.number(), clicked: z.number(),
    },
    annotations: readOnlyAnnotations,
    _meta: readOnlyToolMeta,
  }, async () => {
    const stats = await audited(context, 'lead_recovery.get_stats', () => getLeadRecoveryStats(context));
    return result(`Lead Recovery has ${stats.prospects} prospects, ${stats.sent} sent emails, and ${stats.replied} replies.`, stats);
  });

  server.registerTool('youtube.get_status', {
    title: 'Get YouTube Outreach status',
    description: 'Use this when the user asks whether YouTube Creator Outreach is ready, active, paused, or has queued work.',
    inputSchema: {},
    outputSchema: {
      databaseReady: z.boolean(), active: z.boolean(), campaigns: recordList,
      creatorCounts: countMap, queueCounts: countMap, lastActivityAt: z.string().nullable(),
    },
    annotations: readOnlyAnnotations,
    _meta: readOnlyToolMeta,
  }, async () => {
    const status = await audited(context, 'youtube.get_status', () => getYouTubeStatus(context));
    const summary = !status.databaseReady ? 'YouTube Outreach needs migration 010.' : status.active ? 'YouTube Outreach is active.' : 'YouTube Outreach is paused.';
    return result(summary, status);
  });

  server.registerTool('youtube.list_creators', {
    title: 'List YouTube creators',
    description: 'Use this when the user wants to review tenant-scoped YouTube creator prospects and qualification details.',
    inputSchema: {
      statuses: z.array(z.enum(youtubeCreatorStatuses)).max(youtubeCreatorStatuses.length).optional(),
      minScore: z.number().int().min(0).max(100).optional(),
      limit: z.number().int().min(1).max(100).default(25),
    },
    outputSchema: { creators: recordList, count: z.number() },
    annotations: readOnlyAnnotations,
    _meta: readOnlyToolMeta,
  }, async (input) => {
    const creators = await audited(context, 'youtube.list_creators', () => listYouTubeCreators(context, input));
    return result(`Found ${creators.length} YouTube creators.`, { creators, count: creators.length });
  });

  server.registerTool('youtube.get_replies', {
    title: 'Get YouTube replies',
    description: 'Use this when the user asks for creators who replied or progressed after outreach.',
    inputSchema: { limit: z.number().int().min(1).max(100).default(25) },
    outputSchema: { replies: recordList, count: z.number() },
    annotations: readOnlyAnnotations,
    _meta: readOnlyToolMeta,
  }, async ({ limit }) => {
    const replies = await audited(context, 'youtube.get_replies', () => getYouTubeReplies(context, limit));
    return result(`Found ${replies.length} YouTube creator replies.`, { replies, count: replies.length });
  });

  server.registerTool('youtube.get_stats', {
    title: 'Get YouTube Outreach statistics',
    description: 'Use this when the user asks for YouTube creator discovery, qualification, reply, sample, or client metrics.',
    inputSchema: {},
    outputSchema: {
      discovered: z.number(), qualified: z.number(), contacted: z.number(), replies: z.number(),
      positiveReplies: z.number(), samplesRequested: z.number(), clients: z.number(),
    },
    annotations: readOnlyAnnotations,
    _meta: readOnlyToolMeta,
  }, async () => {
    const stats = await audited(context, 'youtube.get_stats', () => getYouTubeStats(context));
    return result(`YouTube Outreach has ${stats.discovered} creators and ${stats.replies} replies.`, stats);
  });

  return server;
}
