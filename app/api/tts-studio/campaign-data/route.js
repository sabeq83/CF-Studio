import { NextResponse } from 'next/server';
import { listReCampaigns, listReCampaignItems } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch and format Autopilot (RE Campaigns)
    const reCampaignsList = await listReCampaigns();
    const autopilotData = [];

    for (const campaign of reCampaignsList) {
      const items = await listReCampaignItems(campaign.id);
      const analyzedItems = [];

      for (const item of items) {
        if (item.analyze_status === 'analyzed' && item.result_json) {
          try {
            const parsed = JSON.parse(item.result_json);
            // Extract voiceover narrations
            const voiceover = parsed.voiceover || [];
            if (voiceover.length > 0) {
              analyzedItems.push({
                item_id: item.id,
                source_url: item.source_url,
                clips: voiceover.map(vo => vo.narration || vo.text || '')
              });
            }
          } catch (e) {
            console.error(`Failed to parse result_json for item ${item.id}`, e);
          }
        }
      }

      if (analyzedItems.length > 0) {
        autopilotData.push({
          campaign_id: campaign.id,
          campaign_name: campaign.campaign_name,
          items: analyzedItems
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        autopilot: autopilotData
      }
    });

  } catch (error) {
    console.error('Error fetching campaign data for TTS Studio:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
