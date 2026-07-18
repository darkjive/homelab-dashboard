import { useState, useEffect } from 'react';

import {
  Mail,
  Shield,
  BookOpen,
  Smartphone,
  Video,
  MessageCircle,
  Sparkles,
  Plus,
  Trash2,
  ExternalLink,
  Github,
  Gitlab,
  Code,
  Server,
  Database,
  Cloud,
  Terminal,
  Package,
  Lock,
  Key,
  Zap,
  Cpu,
  HardDrive,
  Globe,
  Home,
  Settings,
  User,
  FileText,
  Folder,
  Box,
  X,
  // Custom additions for new icons
  // If 'Brain' is not available, 'Sparkles' or 'MessageCircle' can be used instead
  // For 'Wind', 'Cloud' can be used if no specific icon is available
} from 'lucide-react';

// Available Lucide icons
const ICON_OPTIONS = [
  { name: 'Mail', icon: Mail },
  { name: 'Shield', icon: Shield },
  { name: 'Book', icon: BookOpen },
  { name: 'Phone', icon: Smartphone },
  { name: 'Video', icon: Video },
  { name: 'Chat', icon: MessageCircle },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Github', icon: Github },
  { name: 'Gitlab', icon: Gitlab },
  { name: 'Code', icon: Code },
  { name: 'Server', icon: Server },
  { name: 'Database', icon: Database },
  { name: 'Cloud', icon: Cloud },
  { name: 'Terminal', icon: Terminal },
  { name: 'Package', icon: Package },
  { name: 'Lock', icon: Lock },
  { name: 'Key', icon: Key },
  { name: 'Zap', icon: Zap },
  { name: 'CPU', icon: Cpu },
  { name: 'HardDrive', icon: HardDrive },
  { name: 'Globe', icon: Globe },
  { name: 'Home', icon: Home },
  { name: 'Settings', icon: Settings },
  { name: 'User', icon: User },
  { name: 'File', icon: FileText },
  { name: 'Folder', icon: Folder },
  { name: 'Box', icon: Box },
  // Additional icons for future use
  { name: 'Brain', icon: Sparkles }, // 'Brain' is not in Lucide directly, Sparkles is a good substitute
  { name: 'Palette', icon: Sparkles }, // For Civitai, 'Sparkles' as a creative icon
  { name: 'MessageSquare', icon: MessageCircle }, // For Claude AI, MessageCircle fits well
  { name: 'Wind', icon: Cloud }, // For Mistral AI, Cloud as a symbol for something airy/AI
];

// Color options
const COLOR_OPTIONS = [
  { name: 'Cyan', value: 'text-cyan-400' },
  { name: 'Orange', value: 'text-orange-400' },
  { name: 'Red', value: 'text-red-400' },
  { name: 'Green', value: 'text-green-400' },
  { name: 'Blue', value: 'text-blue-400' },
  { name: 'Purple', value: 'text-purple-400' },
  { name: 'Yellow', value: 'text-yellow-400' },
  { name: 'Pink', value: 'text-pink-400' },
  { name: 'Gray', value: 'text-gray-400' },
];

// Simple Icons for brand logos (CDN links)
const BRAND_LOGOS = [
  { name: 'GitHub', id: 'github', color: '#181717' },
  { name: 'GitLab', id: 'gitlab', color: '#FC6D26' },
  { name: 'Docker', id: 'docker', color: '#2496ED' },
  { name: 'Kubernetes', id: 'kubernetes', color: '#326CE5' },
  { name: 'Google', id: 'google', color: '#4285F4' },
  { name: 'AWS', id: 'amazonaws', color: '#FF9900' },
  { name: 'Azure', id: 'microsoftazure', color: '#0078D4' },
  { name: 'DigitalOcean', id: 'digitalocean', color: '#0080FF' },
  { name: 'Vercel', id: 'vercel', color: '#000000' },
  { name: 'Netlify', id: 'netlify', color: '#00C7B7' },
  { name: 'npm', id: 'npm', color: '#CB3837' },
  { name: 'Tailwind CSS', id: 'tailwindcss', color: '#06B6D4' },
  { name: 'React', id: 'react', color: '#61DAFB' },
  { name: 'Vue.js', id: 'vuedotjs', color: '#4FC08D' },
  { name: 'Supabase', id: 'supabase', color: '#3FCF8E' },
  { name: 'PostgreSQL', id: 'postgresql', color: '#4169E1' },
  { name: 'Redis', id: 'redis', color: '#DC382D' },
  { name: 'MongoDB', id: 'mongodb', color: '#47A248' },
  { name: 'Grafana', id: 'grafana', color: '#F46800' },
  { name: 'Prometheus', id: 'prometheus', color: '#E6522C' },
  { name: 'Jenkins', id: 'jenkins', color: '#D24939' },
  { name: 'Cloudflare', id: 'cloudflare', color: '#F38020' },
  { name: 'Portainer', id: 'portainer', color: '#13BEF9' },
  { name: 'Proxmox', id: 'proxmox', color: '#E57000' },
  { name: 'Home Assistant', id: 'homeassistant', color: '#41BDF5' },
  { name: 'Plex', id: 'plex', color: '#E5A00D' },
  { name: 'Jellyfin', id: 'jellyfin', color: '#00A4DC' },
  { name: 'Nextcloud', id: 'nextcloud', color: '#0082C9' },
  { name: 'Nginx', id: 'nginx', color: '#009639' },
  { name: 'Apache', id: 'apache', color: '#D22128' },
  // Brand icons for custom additions
  { name: 'DuckDuckGo', id: 'duckduckgo', color: '#DE5833' }, // Official color
  { name: 'PHP', id: 'php', color: '#777BB4' },
  { name: 'Node.js', id: 'nodedotjs', color: '#339933' }, // Simple Icons ID is nodedotjs
  { name: 'Google Gemini', id: 'googlegemini', color: '#7947FF' }, // Approximate color, no official logo available yet
  { name: 'Mistral AI', id: 'mistralai', color: '#FF4D6B' }, // Approximate color
];

interface Link {
  id: string;
  name: string;
  url: string;
  iconType: 'lucide' | 'brand' | 'custom';
  iconName?: string;
  brandId?: string;
  customLogoUrl?: string;
  color: string;
}

const DEFAULT_LINKS: Link[] = [
  {
    id: '1',
    name: 'Gmail',
    url: 'https://mail.google.com/',
    iconType: 'lucide',
    iconName: 'Mail',
    color: 'text-red-400',
  },
  {
    id: '2',
    name: 'Proton Mail',
    url: 'https://mail.proton.me/u/0/inbox',
    iconType: 'lucide',
    iconName: 'Shield',
    color: 'text-purple-400',
  },
  {
    id: '3',
    name: 'GitHub',
    url: 'https://github.com/',
    iconType: 'brand',
    brandId: 'github',
    color: 'text-gray-400',
  },
  {
    id: '4',
    name: 'Docker',
    url: 'https://hub.docker.com/',
    iconType: 'brand',
    brandId: 'docker',
    color: 'text-blue-400',
  },
  {
    id: '5',
    name: 'Perplexity AI',
    url: 'https://www.perplexity.ai/',
    iconType: 'lucide',
    iconName: 'Brain',
    color: 'text-orange-400',
  },
  {
    id: '6',
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com/',
    iconType: 'brand',
    brandId: 'duckduckgo',
    color: 'text-orange-500',
  },
  {
    id: '7',
    name: 'PHP (Official Site)',
    url: 'https://www.php.net/',
    iconType: 'brand',
    brandId: 'php',
    color: 'text-indigo-400',
  },
  {
    id: '8',
    name: 'Wikipedia',
    url: 'https://www.wikipedia.org/',
    iconType: 'lucide',
    iconName: 'Globe',
    color: 'text-gray-600',
  },
  {
    id: '9',
    name: 'Node.js',
    url: 'https://nodejs.org/en',
    iconType: 'brand',
    brandId: 'nodedotjs',
    color: 'text-green-500',
  },
  {
    id: '10',
    name: 'NPM',
    url: 'https://www.npmjs.com/',
    iconType: 'brand',
    brandId: 'npm',
    color: 'text-red-600',
  },
  {
    id: '11',
    name: 'Hugging Face',
    url: 'https://huggingface.co/',
    iconType: 'lucide',
    iconName: 'Sparkles',
    color: 'text-yellow-400',
  },
  {
    id: '12',
    name: 'Civitai',
    url: 'https://civitai.com/',
    iconType: 'lucide',
    iconName: 'Palette',
    color: 'text-sky-400',
  },
  {
    id: '13',
    name: 'Claude AI',
    url: 'https://claude.ai/',
    iconType: 'lucide',
    iconName: 'MessageSquare',
    color: 'text-blue-500',
  },
  {
    id: '14',
    name: 'Gemini',
    url: 'https://gemini.google.com/',
    iconType: 'brand',
    brandId: 'googlegemini',
    color: 'text-purple-600',
  },
  {
    id: '15',
    name: 'Mistral AI',
    url: 'https://mistral.ai/',
    iconType: 'lucide',
    iconName: 'Wind',
    color: 'text-rose-500',
  },
  {
    id: '16',
    name: 'Google.de',
    url: 'https://www.google.de/',
    iconType: 'brand',
    brandId: 'google',
    color: 'text-red-500',
  },
];

// Security: Validate link data from localStorage
function validateLinks(data: unknown): data is Link[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    link =>
      typeof link === 'object' &&
      link !== null &&
      typeof link.id === 'string' &&
      typeof link.name === 'string' &&
      typeof link.url === 'string' &&
      (link.url.startsWith('http://') || link.url.startsWith('https://')) &&
      ['lucide', 'brand', 'custom'].includes(link.iconType) &&
      typeof link.color === 'string'
  );
}

export function QuickLinks() {
  const [links, setLinks] = useState<Link[]>(() => {
    try {
      const saved = localStorage.getItem('quick-links');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (validateLinks(parsed)) {
          return parsed;
        }
        console.warn('[SECURITY] Invalid quick-links data in localStorage, using default');
      }
    } catch (error) {
      console.error('[SECURITY] Failed to parse quick-links from localStorage:', error);
    }
    return DEFAULT_LINKS;
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    iconType: 'lucide' as 'lucide' | 'brand' | 'custom',
    iconName: 'Globe',
    brandId: 'github',
    customLogoUrl: '',
    color: 'text-cyan-400',
  });

  useEffect(() => {
    localStorage.setItem('quick-links', JSON.stringify(links));
  }, [links]);

  // React to external settings changes (SettingsPanel)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key: string } | undefined;
      if (detail && detail.key !== 'quick-links') return;
      try {
        const saved = localStorage.getItem('quick-links');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (validateLinks(parsed)) {
            setLinks(parsed);
          }
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('homelab:settings-changed', handler);
    return () => window.removeEventListener('homelab:settings-changed', handler);
  }, []);

  const addLink = () => {
    // Security: Validate URL before adding
    try {
      const urlObj = new URL(formData.url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        alert('Only HTTP/HTTPS URLs are allowed');
        return;
      }
    } catch {
      alert('Invalid URL format');
      return;
    }

    // Security: Sanitize name (prevent XSS)
    const sanitizedName = formData.name.trim().slice(0, 50);
    if (!sanitizedName) {
      alert('Name is required');
      return;
    }

    const newLink: Link = {
      id: Date.now().toString(),
      name: sanitizedName,
      url: formData.url,
      iconType: formData.iconType,
      iconName: formData.iconType === 'lucide' ? formData.iconName : undefined,
      brandId: formData.iconType === 'brand' ? formData.brandId : undefined,
      customLogoUrl: formData.iconType === 'custom' ? formData.customLogoUrl : undefined,
      color: formData.color,
    };

    setLinks([...links, newLink]);
    setShowAddForm(false);
    setFormData({
      name: '',
      url: '',
      iconType: 'lucide',
      iconName: 'Globe',
      brandId: 'github',
      customLogoUrl: '',
      color: 'text-cyan-400',
    });
  };

  const deleteLink = (id: string) => {
    setLinks(links.filter(link => link.id !== id));
  };

  const renderIcon = (link: Link) => {
    if (link.iconType === 'lucide' && link.iconName) {
      const iconConfig = ICON_OPTIONS.find(i => i.name === link.iconName);
      if (iconConfig) {
        const Icon = iconConfig.icon;
        return (
          <Icon className={`w-8 h-8 ${link.color} group-hover:scale-110 transition-transform`} />
        );
      }
    }

    if (link.iconType === 'brand' && link.brandId) {
      const brand = BRAND_LOGOS.find(b => b.id === link.brandId);
      return (
        <img
          src={`https://cdn.simpleicons.org/${link.brandId}/${brand?.color.replace('#', '') || 'ffffff'}`}
          alt={link.name}
          className="w-8 h-8 group-hover:scale-110 transition-transform"
          style={{ filter: 'brightness(1.2)' }}
        />
      );
    }

    if (link.iconType === 'custom' && link.customLogoUrl) {
      return (
        <img
          src={link.customLogoUrl}
          alt={link.name}
          className="w-8 h-8 group-hover:scale-110 transition-transform object-contain"
        />
      );
    }

    return <Globe className={`w-8 h-8 ${link.color} group-hover:scale-110 transition-transform`} />;
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex justify-end mb-2">
        <span className="text-xs bg-cyber-orange/20 text-cyber-orange border border-cyber-orange/40 px-2 py-0.5 rounded font-mono font-bold">
          DEMO
        </span>
      </div>
      {/* Add Link Button */}
      <div className="mb-4">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="cyber-button w-full flex items-center justify-center gap-2 text-sm"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? 'Cancel' : 'Add Link'}
        </button>
      </div>

      {/* Add Link Form */}
      {showAddForm && (
        <div className="mb-4 p-4 bg-cyber-darkbg rounded-lg border border-cyber-cyan">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-black/50 border border-cyber-border rounded text-sm text-gray-300 focus:border-cyber-cyan outline-none"
            />
            <input
              type="url"
              placeholder="URL"
              value={formData.url}
              onChange={e => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-3 py-2 bg-black/50 border border-cyber-border rounded text-sm text-gray-300 focus:border-cyber-cyan outline-none"
            />

            {/* Icon Type */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Icon Type</label>
              <select
                value={formData.iconType}
                onChange={e =>
                  setFormData({
                    ...formData,
                    iconType: e.target.value as 'lucide' | 'brand' | 'custom',
                  })
                }
                className="w-full px-3 py-2 bg-black/50 border border-cyber-border rounded text-sm text-gray-300 focus:border-cyber-cyan outline-none"
              >
                <option value="lucide">Lucide Icon</option>
                <option value="brand">Brand Logo</option>
                <option value="custom">Custom URL</option>
              </select>
            </div>

            {/* Lucide Icon Selection */}
            {formData.iconType === 'lucide' && (
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Icon</label>
                <select
                  value={formData.iconName}
                  onChange={e => setFormData({ ...formData, iconName: e.target.value })}
                  className="w-full px-3 py-2 bg-black/50 border border-cyber-border rounded text-sm text-gray-300 focus:border-cyber-cyan outline-none"
                >
                  {ICON_OPTIONS.map(icon => (
                    <option key={icon.name} value={icon.name}>
                      {icon.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Brand Logo Selection */}
            {formData.iconType === 'brand' && (
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Brand</label>
                <select
                  value={formData.brandId}
                  onChange={e => setFormData({ ...formData, brandId: e.target.value })}
                  className="w-full px-3 py-2 bg-black/50 border border-cyber-border rounded text-sm text-gray-300 focus:border-cyber-cyan outline-none max-h-40 overflow-y-auto"
                >
                  {BRAND_LOGOS.map(brand => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom Logo URL */}
            {formData.iconType === 'custom' && (
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Logo URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={formData.customLogoUrl}
                  onChange={e => setFormData({ ...formData, customLogoUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-black/50 border border-cyber-border rounded text-sm text-gray-300 focus:border-cyber-cyan outline-none"
                />
              </div>
            )}

            {/* Color Selection */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Color</label>
              <select
                value={formData.color}
                onChange={e => setFormData({ ...formData, color: e.target.value })}
                className="w-full px-3 py-2 bg-black/50 border border-cyber-border rounded text-sm text-gray-300 focus:border-cyber-cyan outline-none"
              >
                {COLOR_OPTIONS.map(color => (
                  <option key={color.value} value={color.value}>
                    {color.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={addLink}
              disabled={!formData.name || !formData.url}
              className="w-full px-4 py-2 bg-cyber-cyan text-black font-bold rounded hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Add Link
            </button>
          </div>
        </div>
      )}

      {/* Links Grid */}
      <div className="grid grid-cols-2 gap-3">
        {links.map(link => (
          <div key={link.id} className="relative group">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-cyber-darkbg rounded-lg border border-cyber-border hover:border-cyber-cyan transition-all hover:scale-105 flex flex-col items-center justify-center gap-2 text-center"
            >
              {renderIcon(link)}
              <span className="text-xs font-mono text-gray-400 group-hover:text-cyber-cyan">
                {link.name}
              </span>
              <ExternalLink className="w-3 h-3 text-gray-600 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
            <button
              onClick={() => deleteLink(link.id)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              title="Delete Link"
            >
              <Trash2 className="w-3 h-3 text-white" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
