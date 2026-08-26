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
    schema?: Record<string, any> | Array<Record<string, any>>;
}

export default function SEO({
    title,
    description,
    name = "Optileno",
    type = "website",
    canonicalUrl,
    imageUrl = "https://www.optileno.com/social-preview.png",
    robots = "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1",
    keywords = "AI calendar planner, workflow automation for agency owners, AI planner, task manager, productivity analytics, deep work scheduling",
    schema,
}: SEOProps) {
    const currentUrl = typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : 'https://www.optileno.com/';
    const resolvedCanonicalUrl = canonicalUrl || currentUrl;

    // Default SoftwareApplication Schema if none provided
    const defaultSchema = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Optileno",
        "applicationCategory": "ProductivityApplication",
        "operatingSystem": "Web, Windows, macOS, iOS, Android",
        "url": "https://www.optileno.com/",
        "description": description || "AI calendar planner, task manager, and workflow automation platform for agency owners and high-output teams.",
        "offers": {
            "@type": "Offer",
            "price": "0.00",
            "priceCurrency": "USD",
            "description": "100% Free Explorer Plan Forever (No Credit Card Required)"
        },
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.9",
            "ratingCount": "184",
            "bestRating": "5",
            "worstRating": "1"
        },
        "featureList": [
            "AI Calendar Planner & Time Blocking",
            "Agency Workflow Automation & Task Prioritization",
            "Productivity Analytics & Focus Heatmaps",
            "Burnout Risk Detection",
            "Real-time Chat Leno AI Coach"
        ]
    };

    const finalSchema = schema || defaultSchema;

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
            <meta property="og:image:alt" content="Optileno AI productivity and workflow automation platform" />

            {/* Twitter tags */}
            <meta name="twitter:creator" content="@optilenoai" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={imageUrl} />

            {/* JSON-LD Structured Data Schema Markup */}
            <script type="application/ld+json">
                {JSON.stringify(finalSchema)}
            </script>
        </Helmet>
    );
}
