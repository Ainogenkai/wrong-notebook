import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-utils";
import { getAppConfig, updateAppConfig, type AppConfig } from "@/lib/config";
import { internalError, unauthorized, forbidden } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { OpenAIInstance } from "@/types/api";

const logger = createLogger('api:settings');

export const dynamic = 'force-dynamic';

const MASK = '********';

// 非管理员不允许看到任何真实 API Key
function maskConfigForNonAdmin(config: AppConfig): AppConfig {
    const hasKey = (v?: string) => (v ? MASK : undefined);
    return {
        ...config,
        openai: {
            ...config.openai,
            instances: (config.openai?.instances || []).map((inst: OpenAIInstance) => ({
                ...inst,
                apiKey: inst.apiKey ? MASK : '',
            })),
        },
        gemini: {
            ...config.gemini,
            apiKey: hasKey(config.gemini?.apiKey),
        },
        azure: {
            ...config.azure,
            apiKey: hasKey(config.azure?.apiKey),
        },
    };
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        logger.warn('GET /api/settings blocked: no session');
        return unauthorized();
    }

    const config = getAppConfig();
    if (!isAdmin(session.user)) {
        return NextResponse.json(maskConfigForNonAdmin(config));
    }
    return NextResponse.json(config);
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        logger.warn('POST /api/settings blocked: no session');
        return unauthorized();
    }
    if (!isAdmin(session.user)) {
        logger.warn({ userId: (session.user as { id?: string })?.id }, 'POST /api/settings blocked: non-admin user');
        return forbidden("Admin access required to update settings");
    }

    try {
        const body = await req.json();
        const currentConfig = getAppConfig();

        // Don't save masked keys if they somehow get sent back (for Gemini)
        if (body.gemini?.apiKey === MASK) {
            // 保留原有的 API Key
            body.gemini.apiKey = currentConfig.gemini?.apiKey;
        }

        // For OpenAI instances, preserve original keys for masked entries
        if (body.openai?.instances) {
            const currentInstances = currentConfig.openai?.instances || [];
            body.openai.instances = body.openai.instances.map((instance: OpenAIInstance) => {
                if (instance.apiKey === MASK) {
                    // 查找原有实例并保留其 API Key
                    const originalInstance = currentInstances.find((i: OpenAIInstance) => i.id === instance.id);
                    return {
                        ...instance,
                        apiKey: originalInstance?.apiKey || '',
                    };
                }
                return instance;
            });
        }

        // For Azure, preserve original key if masked
        if (body.azure?.apiKey === MASK) {
            body.azure.apiKey = currentConfig.azure?.apiKey;
        }

        const updatedConfig = updateAppConfig(body);
        return NextResponse.json(updatedConfig);
    } catch (error) {
        logger.error({ error }, 'Failed to update settings');
        return internalError("Failed to update settings");
    }
}
