import { createCfStudioServer } from '../apps/mcp/tools.mjs';

async function main() {
  console.log('=== Test MCP Server Tools: Threads Labs ===\n');

  const dispatchedRequests = [];

  // Mock requester yang mensimulasikan pemanggilan backend API oleh MCP
  const mockRequester = async (path, options = {}) => {
    dispatchedRequests.push({ path, options });
    if (path.includes('/schedule')) {
      return {
        success: true,
        data: {
          name: 'Default Radar Schedule',
          is_active: true,
          active_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
          specific_hours: ['08:00', '12:30', '17:00']
        }
      };
    }
    if (path.includes('/opportunities')) {
      return {
        success: true,
        data: [
          {
            draft_id: 'draft-uuid-001',
            post_content: 'Kamar panas butuh rekomendasi AC hemat listrik',
            product_name: 'Portable Mini AC USB',
            reply_text: 'Pake air cooler mini aja kak, cuma 5W.'
          }
        ]
      };
    }
    if (path.includes('/scan')) {
      return { success: true, message: 'Scan complete', data: { postsFound: 5 } };
    }
    return { success: true };
  };

  const server = createCfStudioServer(mockRequester);

  // Periksa apakah tool terdaftar di server
  const registeredTools = server._registeredTools || server.tools || {};
  const toolNames = Object.keys(registeredTools);

  console.log('1. Memeriksa keberadaan tool Threads Labs di MCP Server:');
  const expectedTools = [
    'cf_threads_labs_scan',
    'cf_threads_labs_list_opportunities',
    'cf_threads_labs_approve_reply',
    'cf_threads_labs_manage_keywords',
    'cf_threads_labs_get_schedule',
    'cf_threads_labs_update_schedule'
  ];

  for (const t of expectedTools) {
    const exists = toolNames.includes(t);
    console.log(`   ${exists ? '✓' : '❌'} Tool "${t}": ${exists ? 'Terdaftar' : 'TIDAK DITEMUKAN'}`);
    if (!exists) throw new Error(`Tool ${t} tidak terdaftar di MCP server!`);
  }

  // 2. Uji eksekusi handler cf_threads_labs_get_schedule
  console.log('\n2. Menguji Handler Tool "cf_threads_labs_get_schedule":');
  const getScheduleTool = registeredTools['cf_threads_labs_get_schedule'];
  const schedResult = await getScheduleTool.handler({});
  console.log('   ✓ Structured Result:', JSON.stringify(schedResult.structuredContent));

  // 3. Uji eksekusi handler cf_threads_labs_list_opportunities
  console.log('\n3. Menguji Handler Tool "cf_threads_labs_list_opportunities":');
  const listOppTool = registeredTools['cf_threads_labs_list_opportunities'];
  const oppResult = await listOppTool.handler({ status: 'ready', limit: 10 });
  console.log('   ✓ Structured Result:', JSON.stringify(oppResult.structuredContent));

  // 4. Uji eksekusi handler cf_threads_labs_scan
  console.log('\n4. Menguji Handler Tool "cf_threads_labs_scan":');
  const scanTool = registeredTools['cf_threads_labs_scan'];
  const scanResult = await scanTool.handler({});
  console.log('   ✓ Structured Result:', JSON.stringify(scanResult.structuredContent));

  console.log('\n=== Semua Pengujian MCP Tool Threads Labs Lolos 100%! ===');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ MCP Tool Test Failed:', err);
  process.exit(1);
});
