import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchVideos } from '../services/api';
import VideoCard from '../components/VideoCard';

const SearchResults = () => {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        if (query) {
            setPage(0);
            setVideos([]);
            doSearch(0);
        }
    }, [query]);

    const doSearch = async (pageNum) => {
        setLoading(true);
        try {
            const res = await searchVideos(query, pageNum, 20);
            const newVideos = res.data.videos || [];
            if (pageNum === 0) {
                setVideos(newVideos);
            } else {
                setVideos(prev => [...prev, ...newVideos]);
            }
            setHasMore(newVideos.length === 20);
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        doSearch(nextPage);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
                Search results for "{query}"
            </h2>
            <p className="text-sm text-gray-500 mb-6">
                {videos.length} video{videos.length !== 1 ? 's' : ''} found
            </p>

            {videos.length === 0 && !loading && (
                <div className="text-center py-16 text-gray-400">
                    <div className="text-5xl mb-3">🔍</div>
                    <p className="text-base">No videos found for "{query}"</p>
                    <p className="text-sm mt-1">Try different keywords</p>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {videos.map(video => (
                    <VideoCard key={video.id} video={video} />
                ))}
            </div>

            {loading && (
                <div className="text-center py-8 text-gray-500">Loading...</div>
            )}

            {!loading && hasMore && videos.length > 0 && (
                <div className="text-center mt-8">
                    <button
                        onClick={loadMore}
                        className="px-6 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700
                            hover:bg-gray-50 transition-colors"
                    >
                        Load More
                    </button>
                </div>
            )}
        </div>
    );
};

export default SearchResults;