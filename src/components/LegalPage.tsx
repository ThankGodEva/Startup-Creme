import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  FileText, 
  Lock, 
  Scale, 
  ArrowLeft, 
  Clock, 
  Globe, 
  CheckCircle2, 
  AlertTriangle, 
  Mail, 
  ExternalLink,
  Printer,
  ChevronRight
} from 'lucide-react';
import { updatePageSEO } from '../lib/seo';

export type LegalDocType = 'privacy' | 'terms';

interface LegalPageProps {
  initialDoc?: LegalDocType;
  currentLocale: string;
  onNavigateHome: () => void;
  onSelectDoc: (doc: LegalDocType) => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({
  initialDoc = 'privacy',
  currentLocale,
  onNavigateHome,
  onSelectDoc,
}) => {
  const [activeDoc, setActiveDoc] = useState<LegalDocType>(initialDoc);
  const [activeSection, setActiveSection] = useState<string>('');

  useEffect(() => {
    setActiveDoc(initialDoc);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [initialDoc]);

  // Update SEO for bots and search engine indexing
  useEffect(() => {
    if (activeDoc === 'privacy') {
      updatePageSEO({
        title: 'Privacy Policy | StartupCrème',
        description: 'StartupCrème Privacy Policy: Learn how we protect personal data, handle cookies, manage newsletter subscriptions, and ensure GDPR/CCPA compliance.',
        canonicalUrl: `https://www.startupcreme.com/${currentLocale}/privacy`,
        type: 'article'
      });
    } else {
      updatePageSEO({
        title: 'Terms of Editorial Service | StartupCrème',
        description: 'StartupCrème Terms of Service: Institutional intelligence disclaimers, intellectual property rules, forum community standards, and YMYL non-financial advice notices.',
        canonicalUrl: `https://www.startupcreme.com/${currentLocale}/terms`,
        type: 'article'
      });
    }
  }, [activeDoc, currentLocale]);

  const handleDocChange = (doc: LegalDocType) => {
    setActiveDoc(doc);
    onSelectDoc(doc);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-24 text-slate-800 font-sans">
      {/* Header Banner */}
      <div className="bg-slate-900 border-b border-slate-800 text-white pt-10 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-6">
            <button 
              onClick={onNavigateHome}
              className="hover:text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dispatch</span>
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-slate-300">Legal & Compliance</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-emerald-400 font-medium capitalize">
              {activeDoc === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
            </span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-emerald-400 font-mono mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Institutional Governance & Transparency</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
                {activeDoc === 'privacy' ? 'Privacy Policy' : 'Terms of Editorial Service'}
              </h1>
              <p className="text-sm sm:text-base text-slate-400 mt-2 max-w-2xl leading-relaxed">
                {activeDoc === 'privacy'
                  ? 'Our comprehensive standards regarding data protection, reader privacy, GDPR/CCPA rights, and secure infrastructure.'
                  : 'Governing agreement, intellectual property standards, community conduct, and institutional financial disclaimers.'}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handlePrint}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 hover:text-white font-mono flex items-center gap-2 transition-colors cursor-pointer"
                title="Print or save as PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>

          {/* Doc Switcher Tabs */}
          <div className="flex items-center gap-2 mt-8 border-b border-slate-800 pb-0">
            <button
              onClick={() => handleDocChange('privacy')}
              className={`px-5 py-3 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                activeDoc === 'privacy'
                  ? 'bg-slate-800/90 text-emerald-400 border-emerald-400'
                  : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/40'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Privacy Policy</span>
            </button>
            <button
              onClick={() => handleDocChange('terms')}
              className={`px-5 py-3 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                activeDoc === 'terms'
                  ? 'bg-slate-800/90 text-cyan-400 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/40'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>Terms of Service</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Main Document Body */}
          <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-xs">
            {/* Document Metadata Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-100 text-xs text-slate-500 font-mono">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Effective Date: August 15, 2026</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-400" />
                <span>Jurisdiction: Multinational (US / EU / UK)</span>
              </div>
            </div>

            {/* PRIVACY POLICY CONTENT */}
            {activeDoc === 'privacy' && (
              <div className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:font-bold prose-headings:text-slate-900 prose-p:text-slate-700 prose-p:leading-relaxed prose-li:text-slate-700 text-sm sm:text-base space-y-8">
                <section id="introduction">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                    <span className="text-emerald-600 font-mono text-lg">01.</span>
                    <span>Executive Commitment to Privacy</span>
                  </h2>
                  <p>
                    Startup Crème (&quot;Startup Crème&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is dedicated to safeguarding the privacy and digital sovereignty of our institutional readership, venture subscribers, contributing founders, and community forum members.
                  </p>
                  <p>
                    This Privacy Policy articulates how we collect, process, store, and protect information when you visit <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs text-slate-800">startupcreme.com</code>, consume our intelligence dispatches, participate in public forums, or interact with our editorial interfaces.
                  </p>
                </section>

                <section id="information-collected">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                    <span className="text-emerald-600 font-mono text-lg">02.</span>
                    <span>Information We Collect</span>
                  </h2>
                  <p>
                    We collect minimal personal data necessary to deliver high-integrity editorial content and authentic community discourse:
                  </p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      <strong>Direct Subscriptions:</strong> When you subscribe to our Institutional Intelligence Dispatch, we store your email address, subscription origin, and preferred regional locale.
                    </li>
                    <li>
                      <strong>Account Profiles & Authentication:</strong> For registered readers, authors, and administrators, we maintain account identifiers, role permissions, display names, and profile avatars managed via secure cryptographic authentication (Supabase Auth).
                    </li>
                    <li>
                      <strong>Community Forum Contributions:</strong> Discussion threads, comments, poll responses, and upvote/downvote interactions submitted within the community forum.
                    </li>
                    <li>
                      <strong>Technical Telemetry:</strong> Anonymized HTTP header metrics, client device user-agents, IP addresses (hashed for DDoS mitigation), and page latency benchmarks required to operate our global edge CDN.
                    </li>
                  </ul>
                </section>

                <section id="use-of-information">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                    <span className="text-emerald-600 font-mono text-lg">03.</span>
                    <span>How We Use Your Information</span>
                  </h2>
                  <p>
                    Information gathered across Startup Crème is strictly utilized for the following authorized purposes:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 not-prose">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="font-semibold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Editorial Delivery</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Distributing curated financial analyses, technology deep dives, and breaking market reports.
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="font-semibold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Platform Security</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Preventing automated comment spam, Sybil poll manipulation, and unauthorized CMS access.
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="font-semibold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Localization</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Routing readers to the most relevant regional subpath (e.g. US, UK, DE, JP, FR).
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="font-semibold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>No Ad Tracking</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        We never sell, rent, or monetize personal reader data to third-party ad networks or data brokers.
                      </p>
                    </div>
                  </div>
                </section>

                <section id="cookies-and-storage">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                    <span className="text-emerald-600 font-mono text-lg">04.</span>
                    <span>Cookies & Client-Side Storage</span>
                  </h2>
                  <p>
                    Startup Crème uses strictly necessary first-party cookies and modern HTML5 Web Storage (localStorage):
                  </p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      <strong>Session Tokens:</strong> Storing cryptographic session tokens to authenticate logged-in contributors and administrators.
                    </li>
                    <li>
                      <strong>Reader Preferences:</strong> Retaining your chosen visual locale, reading bookmarks, and forum voting state directly in your local browser sandbox.
                    </li>
                    <li>
                      <strong>Analytics:</strong> First-party aggregate page counts without third-party surveillance cookies or cross-site tracking pixels.
                    </li>
                  </ul>
                </section>

                <section id="gdpr-ccpa">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                    <span className="text-emerald-600 font-mono text-lg">05.</span>
                    <span>Your Legal Rights (GDPR / CCPA / CPRA)</span>
                  </h2>
                  <p>
                    Regardless of your geographic jurisdiction, Startup Crème guarantees the following data sovereignty rights:
                  </p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Right to Access:</strong> Request a complete export of all personal data held in association with your profile or email.</li>
                    <li><strong>Right to Rectification:</strong> Modify inaccurate profile information or communication preferences.</li>
                    <li><strong>Right to Erasure (&quot;Right to be Forgotten&quot;):</strong> Request the permanent deletion of your account, forum submissions, and newsletter subscription records.</li>
                    <li><strong>Right to Restrict or Object:</strong> Unsubscribe instantaneously from any marketing or intelligence dispatches via the one-click unsubscribe mechanism.</li>
                  </ul>
                </section>

                <section id="data-retention">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                    <span className="text-emerald-600 font-mono text-lg">06.</span>
                    <span>Data Retention & Security Architecture</span>
                  </h2>
                  <p>
                    All database records are hosted on encrypted PostgreSQL infrastructure with Row-Level Security (RLS) policies. Article media assets are distributed via Cloudflare R2 object storage with global SSL/TLS 1.3 encryption in transit.
                  </p>
                  <p>
                    We retain subscriber emails only for the duration of active subscription. Forum discussions remain archived as public editorial record unless deletion is formally requested by the original author.
                  </p>
                </section>

                <section id="contact-dpo">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                    <span className="text-emerald-600 font-mono text-lg">07.</span>
                    <span>Contact Privacy & Legal Office</span>
                  </h2>
                  <p>
                    For inquiries, data access requests, or regulatory filings, contact our Data Protection Officer:
                  </p>
                  <div className="bg-slate-900 text-slate-200 p-5 rounded-xl font-mono text-xs space-y-1.5 not-prose border border-slate-800">
                    <div className="text-emerald-400 font-bold">Startup Crème Legal & Data Protection Bureau</div>
                    <div>Email: <a href="mailto:privacy@startupcreme.com" className="text-cyan-400 hover:underline">privacy@startupcreme.com</a></div>
                    <div>Corporate Inquiries: <a href="mailto:legal@startupcreme.com" className="text-cyan-400 hover:underline">legal@startupcreme.com</a></div>
                    <div className="text-slate-400 pt-1">Response SLA: Within 48 business hours</div>
                  </div>
                </section>
              </div>
            )}

            {/* TERMS OF SERVICE CONTENT */}
            {activeDoc === 'terms' && (
              <div className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:font-bold prose-headings:text-slate-900 prose-p:text-slate-700 prose-p:leading-relaxed prose-li:text-slate-700 text-sm sm:text-base space-y-8">
                <section id="terms-acceptance">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                    <span className="text-cyan-600 font-mono text-lg">01.</span>
                    <span>Acceptance of Editorial Terms</span>
                  </h2>
                  <p>
                    By accessing, browsing, subscribing to, or participating in <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs text-slate-800">startupcreme.com</code> (&quot;the Platform&quot;), you enter into a legally binding agreement with Startup Crème and agree to comply with all terms and conditions set forth herein.
                  </p>
                  <p>
                    If you do not agree to these Terms of Service, you must discontinue your use of our platform immediately.
                  </p>
                </section>

                <section id="non-financial-advice">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                    <span className="text-cyan-600 font-mono text-lg">02.</span>
                    <span>YMYL & Non-Financial Advice Disclaimer</span>
                  </h2>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-900 not-prose space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                      <span>CRITICAL REGULATORY NOTICE: NOT INVESTMENT ADVICE</span>
                    </div>
                    <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                      All articles, market commentaries, venture capital analyses, private credit breakdowns, and technology evaluations published by Startup Crème are crafted strictly for educational, informational, and editorial purposes.
                    </p>
                    <p className="text-xs text-amber-800 font-medium">
                      No content on this site constitutes financial, legal, tax, or investment advice. Startup Crème is not a registered investment advisor, broker-dealer, or financial consultancy. Readers are urged to conduct independent due diligence.
                    </p>
                  </div>
                </section>

                <section id="intellectual-property">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                    <span className="text-cyan-600 font-mono text-lg">03.</span>
                    <span>Intellectual Property & Content Licensing</span>
                  </h2>
                  <p>
                    All original articles, proprietary market syntheses, research charts, data visualizations, and brand assets displayed on Startup Crème are the exclusive intellectual property of Startup Crème and protected by international copyright laws.
                  </p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      <strong>Fair Quotation:</strong> You may quote brief excerpts (up to 150 words) provided that you include prominent attribution and a direct canonical hyperlink to the original article on <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs text-slate-800">startupcreme.com</code>.
                    </li>
                    <li>
                      <strong>Prohibition on Automated Scrapes & Model Scraping:</strong> Automated scraping, harvesting, or ingestion of Startup Crème content for commercial large language model training is expressly prohibited without a signed commercial licensing agreement.
                    </li>
                    <li>
                      <strong>Full-Text Syndication:</strong> Republication of full-length articles requires explicit written consent from the Editor-in-Chief.
                    </li>
                  </ul>
                </section>

                <section id="community-guidelines">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                    <span className="text-cyan-600 font-mono text-lg">04.</span>
                    <span>Discussion Forum & Community Standards</span>
                  </h2>
                  <p>
                    The Startup Crème Community Forum is an institutional forum for founders, software engineers, and venture capital practitioners. By submitting topics, polls, or comments, you agree to:
                  </p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Maintain professional, constructive discourse focused on technology and market fundamentals.</li>
                    <li>Refrain from posting promotional spam, referral links, token shills, or fraudulent solicitations.</li>
                    <li>Avoid publishing confidential insider information or defamatory assertions.</li>
                    <li>Grant Startup Crème a worldwide, royalty-free license to display your public contributions on the platform.</li>
                  </ul>
                  <p className="text-xs text-slate-500 font-mono">
                    Startup Crème reserves the right to remove any content or suspend any user account violating these standards without prior notice.
                  </p>
                </section>

                <section id="disclaimer-warranties">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                    <span className="text-cyan-600 font-mono text-lg">05.</span>
                    <span>Disclaimer of Warranties & Limitation of Liability</span>
                  </h2>
                  <p>
                    The platform and all contents are provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind, whether express or implied.
                  </p>
                  <p>
                    To the maximum extent permitted by applicable law, Startup Crème, its editors, authors, and infrastructure affiliates shall not be liable for any direct, indirect, incidental, punitive, or consequential damages resulting from your access to or reliance on information presented on the platform.
                  </p>
                </section>

                <section id="governing-law">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                    <span className="text-cyan-600 font-mono text-lg">06.</span>
                    <span>Governing Law & Dispute Resolution</span>
                  </h2>
                  <p>
                    These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law principles. Any dispute arising under these Terms shall be resolved through binding arbitration or within competent state and federal courts.
                  </p>
                </section>

                <section id="terms-contact">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                    <span className="text-cyan-600 font-mono text-lg">07.</span>
                    <span>Editorial Inquiries & Licensing</span>
                  </h2>
                  <p>
                    For syndication requests, institutional subscriptions, or editorial permissions:
                  </p>
                  <div className="bg-slate-900 text-slate-200 p-5 rounded-xl font-mono text-xs space-y-1.5 not-prose border border-slate-800">
                    <div className="text-cyan-400 font-bold">Startup Crème Editorial Board</div>
                    <div>Syndication & Licensing: <a href="mailto:licensing@startupcreme.com" className="text-emerald-400 hover:underline">licensing@startupcreme.com</a></div>
                    <div>General Editorial: <a href="mailto:editorial@startupcreme.com" className="text-emerald-400 hover:underline">editorial@startupcreme.com</a></div>
                  </div>
                </section>
              </div>
            )}
          </div>

          {/* Right Sidebar: Table of Contents & Quick Navigation */}
          <div className="lg:col-span-4 space-y-6">
            {/* Quick Document Navigator */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs sticky top-24">
              <h3 className="font-serif text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Document Navigator</span>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  {activeDoc === 'privacy' ? 'Privacy' : 'Terms'}
                </span>
              </h3>

              <div className="space-y-1 text-xs">
                {activeDoc === 'privacy' ? (
                  <>
                    <a href="#introduction" className="block py-1.5 px-2.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors">
                      01. Executive Commitment
                    </a>
                    <a href="#information-collected" className="block py-1.5 px-2.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors">
                      02. Information Collected
                    </a>
                    <a href="#use-of-information" className="block py-1.5 px-2.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors">
                      03. How We Use Information
                    </a>
                    <a href="#cookies-and-storage" className="block py-1.5 px-2.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors">
                      04. Cookies & Local Storage
                    </a>
                    <a href="#gdpr-ccpa" className="block py-1.5 px-2.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors">
                      05. GDPR & CCPA Rights
                    </a>
                    <a href="#data-retention" className="block py-1.5 px-2.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors">
                      06. Security & Retention
                    </a>
                    <a href="#contact-dpo" className="block py-1.5 px-2.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors">
                      07. Contact Legal Office
                    </a>
                  </>
                ) : (
                  <>
                    <a href="#terms-acceptance" className="block py-1.5 px-2.5 rounded-lg text-slate-600 hover:text-cyan-700 hover:bg-cyan-50/60 transition-colors">
                      01. Acceptance of Terms
                    </a>
                    <a href="#non-financial-advice" className="block py-1.5 px-2.5 rounded-lg text-slate-600 hover:text-cyan-700 hover:bg-cyan-50/60 transition-colors font-medium text-amber-700">
                      02. YMYL Non-Financial Notice
                    </a>
                    <a href="#intellectual-property" className="block py-1.5 px-2.5 rounded-lg text-slate-600 hover:text-cyan-700 hover:bg-cyan-50/60 transition-colors">
                      03. Intellectual Property
                    </a>
                    <a href="#community-guidelines" className="block py-1.5 px-2.5 rounded-lg text-slate-600 hover:text-cyan-700 hover:bg-cyan-50/60 transition-colors">
                      04. Community Standards
                    </a>
                    <a href="#disclaimer-warranties" className="block py-1.5 px-2.5 rounded-lg text-slate-600 hover:text-cyan-700 hover:bg-cyan-50/60 transition-colors">
                      05. Disclaimer & Liability
                    </a>
                    <a href="#governing-law" className="block py-1.5 px-2.5 rounded-lg text-slate-600 hover:text-cyan-700 hover:bg-cyan-50/60 transition-colors">
                      06. Governing Law
                    </a>
                    <a href="#terms-contact" className="block py-1.5 px-2.5 rounded-lg text-slate-600 hover:text-cyan-700 hover:bg-cyan-50/60 transition-colors">
                      07. Editorial Inquiries
                    </a>
                  </>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleDocChange(activeDoc === 'privacy' ? 'terms' : 'privacy')}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span>Switch to {activeDoc === 'privacy' ? 'Terms of Service' : 'Privacy Policy'} →</span>
                </button>
              </div>
            </div>

            {/* Regulatory Seal Box */}
            <div className="bg-slate-900 text-slate-300 rounded-2xl p-6 border border-slate-800 text-xs space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Verified Compliance</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Startup Crème adheres to ISO/IEC 27001 data governance practices, EU GDPR General Data Protection Regulation (EU 2016/679), and California Consumer Privacy Act (CCPA).
              </p>
              <div className="pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-500">
                Audit Version: 2026.8.1-REL
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
