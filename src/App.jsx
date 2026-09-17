import { useState, useEffect, useRef } from 'react';
import { Loader2, Copy, Check, Download, ChevronDown, ChevronUp, AlertCircle, FileText, Upload, X } from 'lucide-react';
import mammoth from 'mammoth';

const INK = '#171A21';
const MUTED = '#6B7280';
const BORDER = '#DEDEDA';
const BORDER_SOFT = '#EBEBE7';
const PAPER = '#F6F6F3';
const ACCENT = '#0E7C6B';
const ACCENT_DARK = '#0A5F53';
const HIGHLIGHT = '#B45309';

const PROFILE_PLACEHOLDER = `Paste your resume text here, or upload a .docx or .txt file above.

Include the details you want the letter to draw on: your title and years of experience, core skills, quantified achievements, certifications, and any projects worth mentioning. The more specific your numbers and tools, the more specific the letter will be.`;

const ANTHROPIC_MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT = `You are an expert cover letter writer helping a job applicant create honest, effective, tailored cover letters.

You will be given the candidate's profile (their real skills, achievements, and experience) and a job description.

Rules:
1. Only use skills, tools, achievements, and experience explicitly present in the candidate profile. Never invent, assume, or infer additional experience the candidate has not stated, even if the job description asks for it.
2. If the job description asks for something not in the profile, simply do not mention it. Do not apologize for gaps or list what is missing.
3. If the job description emphasizes something the candidate has partial or adjacent experience with (for example, a different but related cloud provider or tool), you may honestly frame the candidate's real experience as relevant and transferable, but do not claim direct experience with the specific thing that is not in the profile.
4. Structure: an opening paragraph expressing genuine interest, referencing something specific about the role or company from the job description; two middle paragraphs mapping the candidate's real, quantified achievements to the job's key requirements, leading with the strongest and most relevant matches; a closing paragraph mentioning certifications or differentiators plus a call to action.
5. Use specific numbers and metrics from the profile wherever relevant.
6. Keep the letter to one page, roughly four to five paragraphs total.
7. Do not use em dashes anywhere in the letter.
8. Professional, warm, confident tone. Avoid generic filler phrases.
9. Address the letter to "Dear Hiring Team," unless a specific hiring manager name is given in the job description.
10. Output only the cover letter text, starting with the salutation and ending with the sign-off. No preamble, no explanation, no markdown formatting.`;

function useDebouncedSave(value, key, enabled) {
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        // storage unavailable or full, fail silently
      }
    }, 800);
    return () => clearTimeout(t);
  }, [value, key, enabled]);
}

export default function CoverLetterGenerator() {
  const [apiKey, setApiKey] = useState('');
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [profile, setProfile] = useState('');
  const [profileOpen, setProfileOpen] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);
  const [jd, setJd] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [letter, setLetter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('anthropic-api-key');
      if (saved) setApiKey(saved);
    } catch (e) {
      // ignore
    } finally {
      setApiKeyLoaded(true);
    }
  }, []);

  useDebouncedSave(apiKey, 'anthropic-api-key', apiKeyLoaded);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('candidate-profile');
      if (saved) {
        setProfile(saved);
        setProfileOpen(false);
      }
    } catch (e) {
      // no saved profile yet, leave the section open so the person fills it in
    } finally {
      setProfileLoaded(true);
    }
  }, []);

  useDebouncedSave(profile, 'candidate-profile', profileLoaded);

  const handleFileUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploadError('');
    const ext = file.name.split('.').pop().toLowerCase();
    try {
      if (ext === 'txt') {
        const text = await file.text();
        setProfile(text);
        setUploadedFileName(file.name);
      } else if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setProfile(result.value);
        setUploadedFileName(file.name);
      } else {
        setUploadError('That file type is not supported. Upload a .docx or .txt file, or paste your resume text below instead.');
      }
    } catch (err) {
      setUploadError('Could not read that file. Try pasting your resume text directly instead.');
    }
  };

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      setError('Add your Anthropic API key first (see the field above).');
      return;
    }
    if (!profile.trim()) {
      setError('Add your profile first, either by uploading a resume or pasting it in below.');
      return;
    }
    if (!jd.trim()) {
      setError('Paste a job description first.');
      return;
    }
    setError('');
    setLoading(true);
    setLetter('');
    try {
      const userContent = `CANDIDATE PROFILE:\n${profile}\n\nCOMPANY: ${company.trim() || '(infer from job description if present, otherwise use [Company Name])'}\nROLE TITLE: ${role.trim() || '(infer from job description)'}\n\nJOB DESCRIPTION:\n${jd}\n\nWrite the cover letter now.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        }),
      });

      if (response.status === 401) {
        setError('That API key was rejected. Double-check it is correct and active.');
        setLoading(false);
        return;
      }
      if (!response.ok) throw new Error('Request failed');

      const data = await response.json();
      const text = (data.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      if (!text) throw new Error('Empty response');
      setLetter(text);
    } catch (e) {
      setError('Something went wrong generating the letter. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      setError('Could not copy automatically. Select the text and copy it manually.');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([letter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeCompany = (company.trim() || 'draft').replace(/[^a-z0-9]+/gi, ' ').trim();
    a.download = `Cover Letter - ${safeCompany}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ background: PAPER, minHeight: '100%', color: INK }} className="w-full font-sans">
      <div className="max-w-6xl mx-auto px-5 py-8 sm:px-8">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: INK }}>
            Cover letter generator
          </h1>
          <p className="mt-1.5 text-sm sm:text-base" style={{ color: MUTED, maxWidth: '62ch' }}>
            Runs entirely in your browser, no server involved. Add your own API key, your resume,
            and a job description, and generate a letter built only from what's in your profile.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: inputs */}
          <div className="flex flex-col gap-5">
            {/* API key */}
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: '2px' }} className="bg-white px-4 py-3.5">
              <label className="block text-sm font-medium mb-1" style={{ color: INK }}>Anthropic API key</label>
              <p className="text-xs mb-2.5" style={{ color: MUTED }}>
                Runs entirely in your browser. Your key is saved only on this device and is sent directly to
                Anthropic when you generate, never anywhere else. Get one at{' '}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: ACCENT_DARK, textDecoration: 'underline' }}>
                  console.anthropic.com
                </a>.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="flex-1 px-3 py-2 text-sm outline-none bg-white"
                  style={{ border: `1px solid ${BORDER}`, borderRadius: '2px', color: INK, fontFamily: 'ui-monospace, monospace' }}
                />
                <button
                  onClick={() => setShowApiKey((v) => !v)}
                  className="px-3 py-2 text-xs font-medium"
                  style={{ border: `1px solid ${BORDER}`, borderRadius: '2px', color: INK }}
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Profile */}
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: '2px' }} className="bg-white">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-medium" style={{ color: INK }}>Your profile</span>
                <span className="flex items-center gap-2 text-xs" style={{ color: MUTED }}>
                  {profile.trim() ? 'Saved automatically' : 'Required'}
                  {profileOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>
              {profileOpen && (
                <div className="px-4 pb-4" style={{ borderTop: `1px solid ${BORDER_SOFT}` }}>
                  <p className="text-xs pt-3 pb-3" style={{ color: MUTED }}>
                    Works for anyone. Upload a resume or paste your background below, and the generator only draws on what's written here.
                  </p>

                  <div className="flex items-center gap-2.5 mb-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".docx,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="resume-upload"
                    />
                    <button
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white"
                      style={{ border: `1px solid ${BORDER}`, borderRadius: '2px', color: INK }}
                    >
                      <Upload size={13} />
                      Upload resume (.docx or .txt)
                    </button>
                    {uploadedFileName && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: MUTED }}>
                        <FileText size={13} />
                        {uploadedFileName}
                        <button onClick={() => { setUploadedFileName(''); }} aria-label="Clear uploaded file name">
                          <X size={13} />
                        </button>
                      </span>
                    )}
                  </div>

                  {uploadError && (
                    <div className="flex items-start gap-2 text-xs px-3 py-2 mb-3" style={{ background: '#FEF3EC', border: `1px solid ${HIGHLIGHT}33`, borderRadius: '2px', color: '#8A4413' }}>
                      <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  <p className="text-xs mb-2" style={{ color: MUTED }}>
                    PDF isn't supported for automatic text extraction here. Copy and paste the text instead if that's what you have.
                  </p>

                  <textarea
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                    rows={16}
                    placeholder={PROFILE_PLACEHOLDER}
                    className="w-full text-xs leading-relaxed p-3 outline-none resize-y"
                    style={{ border: `1px solid ${BORDER}`, borderRadius: '2px', color: INK, fontFamily: 'ui-monospace, monospace' }}
                  />
                </div>
              )}
            </div>

            {/* Company / role */}
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: MUTED }}>Company (optional)</label>
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full px-3 py-2 text-sm outline-none bg-white"
                    style={{ border: `1px solid ${BORDER}`, borderRadius: '2px', color: INK }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: MUTED }}>Role title (optional)</label>
                  <input
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Senior DevOps Engineer"
                    className="w-full px-3 py-2 text-sm outline-none bg-white"
                    style={{ border: `1px solid ${BORDER}`, borderRadius: '2px', color: INK }}
                  />
                </div>
              </div>
              <p className="text-xs" style={{ color: MUTED }}>Leave these blank and the generator will read them from the job description.</p>
            </div>

            {/* JD */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: MUTED }}>Job description</label>
              <textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                rows={14}
                placeholder="Paste the full job description here."
                className="w-full text-sm leading-relaxed p-3 outline-none resize-y bg-white"
                style={{ border: `1px solid ${BORDER}`, borderRadius: '2px', color: INK }}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm px-3 py-2.5" style={{ background: '#FEF3EC', border: `1px solid ${HIGHLIGHT}33`, borderRadius: '2px', color: '#8A4413' }}>
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full sm:w-auto self-start px-5 py-2.5 text-sm font-medium text-white flex items-center justify-center gap-2 transition-opacity"
              style={{ background: loading ? ACCENT_DARK : ACCENT, borderRadius: '2px', opacity: loading ? 0.85 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Generating' : 'Generate cover letter'}
            </button>
          </div>

          {/* RIGHT: output */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium" style={{ color: MUTED }}>Your cover letter</label>
              {letter && !loading && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                    style={{ border: `1px solid ${BORDER}`, borderRadius: '2px', color: INK }}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                    style={{ border: `1px solid ${BORDER}`, borderRadius: '2px', color: INK }}
                  >
                    <Download size={13} />
                    Download
                  </button>
                </div>
              )}
            </div>

            <div
              className="flex-1 bg-white px-6 py-6 sm:px-8 sm:py-8"
              style={{ border: `1px solid ${BORDER}`, borderRadius: '2px', minHeight: '420px' }}
            >
              {loading && (
                <div className="h-full flex flex-col items-center justify-center gap-3" style={{ color: MUTED }}>
                  <Loader2 size={22} className="animate-spin" />
                  <p className="text-sm">Reading the role and matching it to your profile.</p>
                </div>
              )}

              {!loading && !letter && (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center" style={{ color: MUTED }}>
                  <FileText size={26} strokeWidth={1.5} />
                  <p className="text-sm max-w-xs">
                    Your tailored cover letter will appear here once you paste a job description and generate it.
                  </p>
                </div>
              )}

              {!loading && letter && (
                <textarea
                  value={letter}
                  onChange={(e) => setLetter(e.target.value)}
                  className="w-full h-full outline-none resize-none"
                  style={{
                    minHeight: '380px',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    fontSize: '14.5px',
                    lineHeight: 1.7,
                    color: INK,
                  }}
                />
              )}
            </div>
            {letter && !loading && (
              <p className="text-xs" style={{ color: MUTED }}>Editable. Tweak anything before you copy or download it.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
