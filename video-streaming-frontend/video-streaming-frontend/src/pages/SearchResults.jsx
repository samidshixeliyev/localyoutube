import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchVideos } from '../services/api';
import VideoCard from '../components/VideoCard';
import { Search, Loader2 } from 'lucide-react';

const SearchResults = () => {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        if (query) {
            setPage(0);
            setVideos([]);
            setTotal(0);
            doSearch(0);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    const doSearch = async (pageNum) => {
        setLoading(true);
        try {
            const res = await searchVideos(query, pageNum, 20);
            const newVideos = res.data.videos || [];
            const t = res.data.total ?? newVideos.length;
            if (pageNum === 0) {
                setVideos(newVideos);
                setTotal(t);
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
            {/* Header */}
            <div className="flex items-center gap-2 mb-1">
                <Search className="h-5 w-5 text-primary-600 flex-shrink-0" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    "<span className="text-primary-600 dark:text-primary-400">{query}</span>" üçün nəticələr
                </h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 ml-7">
                {loading && videos.length === 0 ? 'Axtarılır…' : `${videos.length} video tapıldı`}
            </p>

            {/* Empty state */}
            {videos.length === 0 && !loading && (
                <div className="text-center py-20">
                    <div className="w-16 h-16 mx-auto bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mb-4">
                        <Search className="h-8 w-8 text-primary-400" />
                    </div>
                    <p className="text-base text-gray-600 dark:text-gray-400 font-medium">
                        "<span className="text-gray-900 dark:text-gray-100">{query}</span>" üçün video tapılmadı
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                        Fərqli açar sözlər cəhd edin
                    </p>
                </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {videos.map(video => (
                    <VideoCard key={video.id} video={video} highlight={query} />
                ))}
            </div>

            {/* Loading skeleton */}
            {loading && (
                <div className="flex items-center justify-center py-8 gap-2 text-gray-500 dark:text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Yüklənir…</span>
                </div>
            )}

            {/* Load more */}
            {!loading && hasMore && videos.length > 0 && (
                <div className="text-center mt-8">
                    <button
                        onClick={loadMore}
                        className="px-6 py-2.5 bg-white dark:bg-army-800 border border-gray-300 dark:border-army-600 rounded-xl text-sm text-gray-700 dark:text-gray-300
                            hover:bg-gray-50 dark:hover:bg-army-700 transition-colors shadow-sm"
                    >
                        Daha çox yüklə
                    </button>
                </div>
            )}
        </div>
    );
};

export default SearchResults;
