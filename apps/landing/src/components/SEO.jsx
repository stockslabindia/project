import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ 
  title, 
  description, 
  keywords, 
  url, 
  image = 'https://stockslab.live/og-image.png', 
  type = 'website',
  robots = 'index, follow',
  schema,
  schemas = []
}) => {
  const siteName = 'Trade Smarter';
  const fullTitle = title ? `${title} | ${siteName}` : `${siteName} - High Performance Trading Platform`;
  
  const defaultDescription = "Discover Stocks Lab, the best broker in India. Experience lightning-fast execution, zero hidden fees, and multi-market access. The ultimate Tradex1 and Markettrade alternative.";
  const metaDescription = description || defaultDescription;
  
  const defaultKeywords = "best dabba trading in india, best broker in india, tradex1 alternative, markettrade alternative, top trading platform india, fast execution trading, stock broker alternative";
  const metaKeywords = keywords || defaultKeywords;
  
  const siteUrl = 'https://stockslab.live';
  const fullUrl = url ? `${siteUrl}${url}` : siteUrl;

  // Combine schemas into a single list
  const allSchemas = [];
  if (schema) {
    allSchemas.push(schema);
  }
  if (Array.isArray(schemas)) {
    allSchemas.push(...schemas);
  }

  return (
    <Helmet>
      {/* Standard metadata tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="keywords" content={metaKeywords} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="en_IN" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={image} />

      {/* Dynamic JSON-LD Schemas */}
      {allSchemas.map((s, idx) => (
        <script key={idx} type="application/ld+json">
          {JSON.stringify(s)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEO;

