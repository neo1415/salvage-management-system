export const PROTECTED_EMAIL_TERMS = ['adetimilehin', 'adedaniel', 'adneo', 'neowalker', 'alaade', 'mayadenu'] as const;

export function isProtectedEmail(email: unknown): boolean {
  return typeof email === 'string' && PROTECTED_EMAIL_TERMS.some(term => email.toLowerCase().includes(term));
}

export const RETAIN_TABLES = [
  'algorithm_config', 'departments', 'system_config', 'damage_deductions', 'vehicle_valuations',
] as const;

export const FILTER_TABLES = [
  'users', 'vendors', 'business_policy_versions', 'provider_verification_records',
  'provider_webhook_events', 'image_upload_metadata', 'notification_preferences',
  'escrow_wallets', 'ledger_accounts',
] as const;

export const WIPE_TABLES = [
  'algorithm_config_history', 'analytics_rollups', 'api_cost_analytics', 'api_usage_tracking',
  'asset_performance_analytics', 'attribute_performance_analytics', 'auction_documents',
  'auction_early_close_requests', 'auction_winners', 'auctions', 'audit_logs', 'background_jobs',
  'bids', 'business_policy_snapshots', 'config_change_history', 'conversion_funnel_analytics',
  'data_right_requests', 'deposit_events', 'deposit_forfeitures', 'document_downloads',
  'duplicate_photo_matches', 'feature_vectors', 'fraud_alerts', 'fraud_attempts',
  'fraud_detection_logs', 'geographic_patterns_analytics', 'grace_extensions', 'interactions',
  'internet_search_logs', 'internet_search_metrics', 'internet_search_results', 'ledger_entries',
  'login_risk_events', 'market_data_cache', 'market_data_sources', 'ml_training_datasets',
  'notifications', 'payments', 'photo_hash_index', 'photo_hashes', 'pickup_evidence',
  'popular_search_queries', 'prediction_logs', 'predictions', 'push_subscriptions', 'ratings',
  'recommendation_logs', 'recommendations', 'reconciliation_alerts', 'reconciliation_logs',
  'release_forms', 'report_audit_log', 'report_cache', 'report_favorites', 'report_templates',
  'salvage_cases', 'scheduled_reports', 'schema_evolution_log', 'scraping_logs',
  'search_performance_metrics', 'search_quality_metrics', 'search_trend_analytics',
  'search_usage_analytics', 'seed_registry', 'session_analytics', 'temporal_patterns_analytics',
  'unmatched_transactions', 'user_trusted_login_contexts', 'valuation_audit_logs',
  'valuation_evidence', 'vendor_interactions', 'vendor_recommendations', 'vendor_segments',
  'verification_costs', 'wallet_transactions',
] as const;

export function validateResetTables(tables: string[]): void {
  const classified = new Set<string>([...RETAIN_TABLES, ...FILTER_TABLES, ...WIPE_TABLES]);
  const unknown = tables.filter(table => !classified.has(table));
  const missing = [...classified].filter(table => !tables.includes(table));
  if (unknown.length || missing.length) {
    throw new Error(`Schema changed; refusing reset. Unknown: ${unknown.join(', ')}. Missing: ${missing.join(', ')}`);
  }
}

export function collectUrls(value: unknown, urls = new Set<string>()): Set<string> {
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) urls.add(value);
  else if (Array.isArray(value)) value.forEach(item => collectUrls(item, urls));
  else if (typeof value === 'object' && value !== null) Object.values(value).forEach(item => collectUrls(item, urls));
  return urls;
}

const APP_MEDIA_PREFIXES = new Set([
  'salvage-cases', 'pickup-evidence', 'profile-pictures', 'kyc-documents',
  'kyc_images', 'gemini-test-photos', 'test-folder',
]);

export function shouldDeleteCloudinaryAsset(
  resource: { public_id: string; format?: string }, preservedUrls: string[], preservedOwnerIds: string[]
): boolean {
  const [prefix, owner] = resource.public_id.split('/');
  if (!APP_MEDIA_PREFIXES.has(prefix)) return false;
  if (['kyc-documents', 'kyc_images', 'profile-pictures'].includes(prefix)
      && preservedOwnerIds.includes(owner)) return false;
  const endings = [`/${resource.public_id}`];
  if (resource.format) endings.push(`/${resource.public_id}.${resource.format}`);
  return !preservedUrls.some(value => {
    try {
      const url = new URL(value);
      if (url.hostname !== 'res.cloudinary.com') return false;
      const path = decodeURIComponent(url.pathname);
      return endings.some(ending => path.endsWith(ending));
    } catch { return false; }
  });
}

export function shouldDeleteKycObject(name: string, preservedUrls: string[], preservedOwnerIds: string[]): boolean {
  if (preservedOwnerIds.includes(name.split('/')[0])) return false;
  return !preservedUrls.some(value => {
    try { return decodeURIComponent(new URL(value).pathname).endsWith(`/kyc-documents/${name}`); }
    catch { return false; }
  });
}
