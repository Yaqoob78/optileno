import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title: string;
    description: string;
    name?: string;
    type?: string;
    canonicalUrl?: string;
    imageUrl?: string;
    robots?: string;
    keywords?: string;
}

export default function SEO({
    title,
    description,
    name = "Optileno",
    type = "website",
    canonicalUrl,
    imageUrl = "https://www.optileno.com/social-preview.png",
    robots = "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1",
    keywords,
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
            {keywords && <meta name="keywords" content={keywords} />}
            <meta name="robots" content={robots} />
            <link rel="canonical" href={resolvedCanonicalUrl} />

            {/* OpenGraph tags */}
            <meta property="og:type" content={type} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:site_name" content={name} />
            <meta property="og:url" content={resolvedCanonicalUrl} />
            <meta property="og:image" content={imageUrl} />
            <meta property="og:image:alt" content="Optileno AI productivity platform preview" />

            {/* Twitter tags */}
            <meta name="twitter:creator" content={name} />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={imageUrl} />
        </Helmet>
    );
}
