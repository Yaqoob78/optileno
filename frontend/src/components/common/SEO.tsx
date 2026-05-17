import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title: string;
    description: string;
    name?: string;
    type?: string;
    canonicalUrl?: string;
}

export default function SEO({
    title,
    description,
    name = "Optileno",
    type = "website",
    canonicalUrl,
}: SEOProps) {
    const currentUrl = typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : 'https://www.optileno.com/';
    const resolvedCanonicalUrl = canonicalUrl || currentUrl;

    return (
        <Helmet>
            {/* Standard metadata tags */}
            <title>{title}</title>
            <meta name='description' content={description} />
            <link rel="canonical" href={resolvedCanonicalUrl} />

            {/* OpenGraph tags */}
            <meta property="og:type" content={type} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:site_name" content={name} />
            <meta property="og:url" content={resolvedCanonicalUrl} />

            {/* Twitter tags */}
            <meta name="twitter:creator" content={name} />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
        </Helmet>
    );
}
