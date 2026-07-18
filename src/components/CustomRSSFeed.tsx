import { useState, useEffect } from 'react';
import { RSSFeed } from './RSSFeed';
import { Edit2, Save, Plus, Trash2 } from 'lucide-react';

interface SavedFeed {
  id: string;
  name: string;
  url: string;
}

const defaultFeeds: SavedFeed[] = [
  { id: '1', name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
  { id: '2', name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { id: '3', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
];

export function CustomRSSFeed() {
  const [feeds, setFeeds] = useState<SavedFeed[]>(() => {
    const saved = localStorage.getItem('custom-rss-feeds');
    return saved ? JSON.parse(saved) : defaultFeeds;
  });
  const [activeFeedId, setActiveFeedId] = useState<string>(feeds[0]?.id || '');
  const [isEditing, setIsEditing] = useState(false);
  const [newFeedName, setNewFeedName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');

  useEffect(() => {
    localStorage.setItem('custom-rss-feeds', JSON.stringify(feeds));
  }, [feeds]);

  const addFeed = () => {
    if (!newFeedName.trim() || !newFeedUrl.trim()) return;

    const newFeed: SavedFeed = {
      id: Date.now().toString(),
      name: newFeedName.trim(),
      url: newFeedUrl.trim(),
    };

    setFeeds(prev => [...prev, newFeed]);
    setActiveFeedId(newFeed.id);
    setNewFeedName('');
    setNewFeedUrl('');
  };

  const removeFeed = (id: string) => {
    setFeeds(prev => prev.filter(f => f.id !== id));
    if (activeFeedId === id) {
      setActiveFeedId(feeds[0]?.id || '');
    }
  };

  const activeFeed = feeds.find(f => f.id === activeFeedId);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-lg font-bold cyber-glow">CUSTOM RSS</h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="ml-auto p-1.5 rounded bg-cyber-darkbg border border-cyber-border hover:border-cyber-cyan transition-all"
          title={isEditing ? 'Done editing' : 'Manage feeds'}
        >
          {isEditing ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Edit Mode */}
      {isEditing && (
        <div className="mb-3 p-3 bg-cyber-darkbg border border-cyber-cyan rounded space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Feed name..."
              value={newFeedName}
              onChange={e => setNewFeedName(e.target.value)}
              className="flex-1 px-2 py-1 bg-cyber-darkbg border border-cyber-border rounded text-sm text-gray-200 focus:border-cyber-cyan focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="Feed URL..."
              value={newFeedUrl}
              onChange={e => setNewFeedUrl(e.target.value)}
              className="flex-1 px-2 py-1 bg-cyber-darkbg border border-cyber-border rounded text-sm text-gray-200 focus:border-cyber-cyan focus:outline-none"
            />
            <button
              onClick={addFeed}
              className="px-3 py-1 bg-green-900/30 text-green-400 border border-green-500/50 rounded hover:bg-green-900/50 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Feed List */}
          <div className="space-y-1 mt-2">
            {feeds.map(feed => (
              <div
                key={feed.id}
                className="flex items-center gap-2 p-2 bg-cyber-darkbg/50 border border-cyber-border rounded"
              >
                <span className="flex-1 text-xs text-gray-300 truncate">{feed.name}</span>
                <button
                  onClick={() => removeFeed(feed.id)}
                  className="p-1 text-red-400 hover:bg-red-900/30 rounded transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feed Tabs */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
        {feeds.map(feed => (
          <button
            key={feed.id}
            onClick={() => setActiveFeedId(feed.id)}
            className={`px-3 py-1 text-xs font-bold rounded whitespace-nowrap transition-all ${
              activeFeedId === feed.id
                ? 'bg-cyber-cyan text-cyber-darkbg'
                : 'bg-cyber-darkbg border border-cyber-border text-gray-400 hover:border-cyber-cyan'
            }`}
          >
            {feed.name}
          </button>
        ))}
      </div>

      {/* Feed Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {activeFeed ? (
          <RSSFeed key={activeFeed.id} url={activeFeed.url} maxItems={15} />
        ) : (
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm">No feeds configured</p>
          </div>
        )}
      </div>
    </div>
  );
}
