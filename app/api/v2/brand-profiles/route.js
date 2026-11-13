import { NextResponse } from 'next/server';
import { getAllBrandProfiles, createBrandProfile } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { withTenantContext } from '@/lib/auth';
import { validateBrandEditorialDefaults } from '@/lib/brand-editorial-defaults';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (_req, _ctx, user) => {
  try {
    let profiles = await getAllBrandProfiles();
    if (user.role !== 'admin') {
      const allowed = new Set(user.assignedBrandIds || []);
      profiles = profiles.filter(profile => allowed.has(profile.id));
    }
    return NextResponse.json({ success: true, data: profiles });
  } catch (error) {
    console.error('Brand Profiles GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (req, _ctx, user) => {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json();
    const id = uuidv4();

    if (!body.brand_name || !body.visual_signature) {
      return NextResponse.json({ success: false, error: 'Brand Name dan Visual Signature wajib diisi.' }, { status: 400 });
    }

    const editorial = validateBrandEditorialDefaults(body);
    await createBrandProfile({
      id,
      brand_name: body.brand_name,
      tone_of_voice: body.tone_of_voice,
      visual_signature: body.visual_signature,
      raw_guideline_text: body.raw_guideline_text,
      guideline_filename: body.guideline_filename,
      storage_provider: body.storage_provider,
      nextcloud_target_folder: body.nextcloud_target_folder,
      drive_target_folder: body.drive_target_folder,
      drive_glabs_folder_id: body.drive_glabs_folder_id,
      webhook_host: body.webhook_host,
      webhook_port: body.webhook_port,
      webhook_api_key: body.webhook_api_key,
      logo_url: body.logo_url,
      brand_color: body.brand_color,
      brand_tagline: body.brand_tagline,
      default_cta_tiktok: body.default_cta_tiktok,
      default_cta_facebook: body.default_cta_facebook,
      default_cta_youtube: body.default_cta_youtube,
      safety_notice_text: body.safety_notice_text,
      presenter_name: body.presenter_name,
      presenter_role: body.presenter_role,
      brand_location: body.brand_location,
      ...editorial,
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Brand Profiles POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: error.code === 'BRAND_EDITORIAL_VALIDATION' ? 400 : 500 });
  }
});
