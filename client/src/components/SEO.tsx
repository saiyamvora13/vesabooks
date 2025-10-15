import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article';
}

export function SEO({ title, description, path = '', image, type = 'website' }: SEOProps) {
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const fullUrl = `${siteUrl}${path}`;
  const defaultImage = `${siteUrl}/og-image.png`;
  const ogImage = image || defaultImage;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      
      {/* Additional Meta Tags */}
      <link rel="canonical" href={fullUrl} />
    </Helmet>
  );
}
