import { Ailogw, ElevenLabsVoiceProvider, PrepareCallContext } from "@blackbox_ai/ai-logs-watcher";

   const voiceProvider = new ElevenLabsVoiceProvider({
        credentials: {
            apiKey: process.env["ELEVENLABS_API_KEY"]!
        }
    });

    const ailogwatch = new Ailogw({
        name: "vercel",
        log: true,
        twilio: {
            numberFrom: process.env["AILOGW_NUMBER_FROM"]   // Using Twilio test number for "from"
        },
        voice: voiceProvider,
        polling: {
            delay: "1000:ms",
            tailAmount: 10
        },
        events: {
            async alert({ options, logs, diagnostic, sendSms, voice }) {
                void options, logs;
                const numberTo = process.env["AILOGW_NUMBER_TO"]!;
                switch (diagnostic.raw.status) {
                    case "warning":
                    case "normal": {
                        // await sendSms(numberTo, diagnostic.formatted);
                        return;
                    }
                    case "critical": {
                        if (voice && voice instanceof ElevenLabsVoiceProvider) {
                            const context: PrepareCallContext = {
                                githubRepositoryUrl: "https://github.com/shadokan87/server-demo",
                                namespace: options.name,
                                "the current nodejs version": "20.0.1",
                                "the database": "sqlite",
                                "emergency contact": "Richard Rizk, CTO at blackbox.ai, phone number +14427523429"
                            };
                            const call = await voice.prepareCall(diagnostic.formatted, numberTo, context);
                            console.log(`calling: ${numberTo}`, JSON.stringify(context, null, 2));
                            await call();
                            process.exit(0);
                        }
                        return;
                    }
                }
            }
        }
    });
    const logger = ailogwatch.createLogger();
    export {
        ailogwatch,
        logger
    }