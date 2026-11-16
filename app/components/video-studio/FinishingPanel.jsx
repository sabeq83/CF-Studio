'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import CampaignSourceBanner from './CampaignSourceBanner';
import TemplateGallery from './TemplateGallery';
import AudioModePicker from './AudioModePicker';
import FinishingPlanEditor from './FinishingPlanEditor';

const FinishingTemplatePreview = dynamic(() => import('../FinishingTemplatePreview'), { ssr: false });

export default function FinishingPanel({
  videoSourceType,
  videoPaths = [],
  audioSourceType,
  audioMode,
  onChangeAudioMode,
  audioFileCount = 0,
  finishingTemplate,
  onChangeTemplate,
  finishingPlan,
  onChangePlan,
  captionMode,
  onChangeCaptionMode,
  skin,
  onChangeSkin,
  brandName,
  onChangeBrandName,
  onAutoSelectTtsBatch,
  onValidityChange,
  voTexts = [],
  productData = null,
  recipeData = null,
  isHerbalProduct = true
}) {
  const [sourceData, setSourceData] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');
  const [loadingSource, setLoadingSource] = useState(false);
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [validation, setValidation] = useState({ planValid: true, planErrors: [], planWarnings: [] });

  // 1. Fetch finishing source when campaign video is selected
  const fetchFinishingSource = async () => {
    if (!videoSourceType || (videoSourceType !== 're_campaign' && videoSourceType !== 'instant_factory')) {
      setSourceData(null);
      setConflict(false);
      return;
    }

    if (!videoPaths || videoPaths.length === 0) {
      setSourceData(null);
      return;
    }

    setLoadingSource(true);
    try {
      const res = await fetch(`/api/video-studio/finishing-source?video_source_type=${videoSourceType}&video_path=${encodeURIComponent(JSON.stringify(videoPaths))}`);
      const json = await res.json();

      if (json.conflict) {
        setConflict(true);
        setConflictMessage(json.message);
        setSourceData(null);
      } else if (json.success && json.data) {
        setConflict(false);
        setSourceData(json.data);

        // Auto-apply source metadata if user hasn't started manual overrides
        if (!isManualEditing) {
          if (json.data.finishingTemplate) {
            onChangeTemplate(json.data.finishingTemplate);
          }
          if (json.data.finishingPlan) {
            onChangePlan(json.data.finishingPlan);
          }
          if (json.data.skin) {
            onChangeSkin(json.data.skin);
          }
          if (json.data.brand?.name) {
            onChangeBrandName(json.data.brand.name);
          }
          if (json.data.captionMode) {
            onChangeCaptionMode(json.data.captionMode);
          }
          if (json.data.ttsBatchId && typeof onAutoSelectTtsBatch === 'function') {
            onAutoSelectTtsBatch(json.data.ttsBatchId);
          }
        }

        setValidation({
          planValid: json.data.planValid,
          planErrors: json.data.planErrors || [],
          planWarnings: json.data.planWarnings || []
        });
      } else {
        setSourceData(null);
      }
    } catch (err) {
      console.warn('[FinishingPanel] Failed to fetch finishing source:', err);
    } finally {
      setLoadingSource(false);
    }
  };

  useEffect(() => {
    fetchFinishingSource();
  }, [videoSourceType, JSON.stringify(videoPaths)]);

  // Validate plan client-side
  useEffect(() => {
    if (finishingTemplate === 'none') {
      const validState = { planValid: true, planErrors: [], planWarnings: [] };
      setValidation(validState);
      if (typeof onValidityChange === 'function') onValidityChange(true);
      return;
    }

    const errors = [];
    if (!finishingPlan || !finishingPlan.hook || !finishingPlan.hook.trim()) {
      errors.push('Hook title wajib diisi untuk template finishing.');
    }

    const isValid = errors.length === 0;
    setValidation(prev => ({
      ...prev,
      planValid: isValid,
      planErrors: errors
    }));

    if (typeof onValidityChange === 'function') {
      onValidityChange(isValid);
    }
  }, [finishingTemplate, finishingPlan?.hook]);

  const handleUseAsIs = () => {
    setIsManualEditing(false);
    if (sourceData) {
      if (sourceData.finishingTemplate) onChangeTemplate(sourceData.finishingTemplate);
      if (sourceData.finishingPlan) onChangePlan(sourceData.finishingPlan);
      if (sourceData.skin) onChangeSkin(sourceData.skin);
      if (sourceData.brand?.name) onChangeBrandName(sourceData.brand.name);
      if (sourceData.captionMode) onChangeCaptionMode(sourceData.captionMode);
      if (sourceData.ttsBatchId && typeof onAutoSelectTtsBatch === 'function') {
        onAutoSelectTtsBatch(sourceData.ttsBatchId);
      }
    }
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      marginBottom: '24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            4. Finishing Template & Layout Overlay
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Pilih 1 dari 8 template finishing dinamis untuk meningkatkan engagement video.
          </p>
        </div>

        {finishingTemplate !== 'none' && (
          <button
            type="button"
            onClick={() => setShowLivePreview(!showLivePreview)}
            style={{
              background: showLivePreview ? 'var(--action-primary)' : 'var(--surface-interactive)',
              color: showLivePreview ? 'var(--on-action-primary)' : 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>👁️</span>
            <span>{showLivePreview ? 'Tutup Live Preview' : 'Buka Live Preview'}</span>
          </button>
        )}
      </div>

      {/* Campaign Source Banner */}
      <CampaignSourceBanner
        sourceData={sourceData}
        conflict={conflict}
        conflictMessage={conflictMessage}
        loading={loadingSource}
        onUseAsIs={handleUseAsIs}
        onEditManual={() => setIsManualEditing(!isManualEditing)}
        onRefresh={fetchFinishingSource}
        isManualEditing={isManualEditing}
      />

      {/* Audio Mode Picker */}
      <AudioModePicker
        audioSourceType={audioSourceType}
        audioMode={audioMode}
        onChangeAudioMode={onChangeAudioMode}
        videoClipCount={videoPaths?.length || 0}
        audioFileCount={audioFileCount}
      />

      {/* Template Gallery */}
      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
        Pilih Template Layout:
      </label>
      <TemplateGallery
        selectedTemplate={finishingTemplate}
        onSelectTemplate={onChangeTemplate}
        recommendedTemplate={sourceData?.finishingTemplate}
      />

      {/* Finishing Plan Editor */}
      {finishingTemplate !== 'none' && (
        <FinishingPlanEditor
          templateId={finishingTemplate}
          plan={finishingPlan}
          onChangePlan={onChangePlan}
          validation={validation}
          captionMode={captionMode}
          onChangeCaptionMode={onChangeCaptionMode}
          skin={skin}
          onChangeSkin={onChangeSkin}
          brandName={brandName}
          onChangeBrandName={onChangeBrandName}
          voTexts={voTexts}
          productData={productData || sourceData?.productData}
          recipeData={recipeData || sourceData?.recipeData}
          isHerbalProduct={isHerbalProduct}
        />
      )}

      {/* Live Preview Modal / Dropdown */}
      {showLivePreview && finishingTemplate !== 'none' && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: 'var(--surface-raised)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Live Finishing Preview: {finishingTemplate} ({skin})
            </h4>
            <button
              type="button"
              onClick={() => setShowLivePreview(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}
            >
              &times;
            </button>
          </div>

          <FinishingTemplatePreview
            finishingTemplate={finishingTemplate}
            finishingSkin={skin}
            captionMode={captionMode}
            brandName={brandName}
            hookTitle={finishingPlan?.hook || ''}
          />
        </div>
      )}
    </div>
  );
}
