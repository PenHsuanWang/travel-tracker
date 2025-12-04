import React, { useState, useEffect } from 'react';
import userService from '../services/userService';
import MemberCard from '../components/views/MemberCard';
import './CommunityPage.css';

const CommunityPage = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
        setPage(1);
        fetchMembers(1, search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Load more
  useEffect(() => {
      if (page > 1) {
          fetchMembers(page, search);
      }
  }, [page]);

  const fetchMembers = async (pageNum, searchQuery) => {
    try {
      setLoading(true);
      const data = await userService.getPublicUsers((pageNum - 1) * 20, 20, searchQuery);
      
      if (pageNum === 1) {
        setMembers(data);
      } else {
        setMembers(prev => {
            // Filter out duplicates just in case
            const existingIds = new Set(prev.map(m => m.id));
            const newMembers = data.filter(m => !existingIds.has(m.id));
            return [...prev, ...newMembers];
        });
      }
      
      setHasMore(data.length === 20);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Failed to load community members');
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  return (
    <div className="community-page">
      <div className="community-header">
        <h1>Community</h1>
        <div className="search-container">
          <input 
            type="text" 
            placeholder="Search members..." 
            value={search}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="members-grid">
        {members.map(member => (
          <MemberCard key={member.id} user={member} />
        ))}
      </div>

      {loading && <div className="loading">Loading...</div>}

      {!loading && hasMore && (
        <div className="load-more">
          <button onClick={() => setPage(prev => prev + 1)}>Load More</button>
        </div>
      )}
      
      {!loading && members.length === 0 && (
        <div className="no-results">No members found.</div>
      )}
    </div>
  );
};

export default CommunityPage;
