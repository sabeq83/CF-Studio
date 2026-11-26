import PublicAffiliateCatalogClient from './PublicAffiliateCatalogClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Katalog Link Aff',
  description: 'Katalog tautan affiliate produk CF Studio berdasarkan Brand Profile.'
};

export default function PublicAffiliateCatalogPage() {
  return <PublicAffiliateCatalogClient />;
}
