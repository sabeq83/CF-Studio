import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { ingestRecipePlannerToPillarCampaign } from '@/lib/recipe-campaign-ingest';

export const POST = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: plannerId } = await params;
    const body = await request.json().catch(() => ({}));
    const {
      selected_row_ids,
      selectedRowIds,
      campaign_name,
      campaignName,
      global_settings,
      globalSettings,
      execution_mode,
      executionMode
    } = body;

    const mergedSettings = {
      ...(global_settings || globalSettings || {}),
      execution_mode: execution_mode || executionMode || global_settings?.execution_mode || globalSettings?.execution_mode || 'manual_review'
    };

    const result = await ingestRecipePlannerToPillarCampaign({
      plannerId,
      selectedRowIds: selected_row_ids || selectedRowIds || [],
      campaignName: campaign_name || campaignName || null,
      globalSettings: mergedSettings,
      tenantId: user?.tenantId || 'default_tenant'
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[API /content-planner/:id/ingest-recipe Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
});
