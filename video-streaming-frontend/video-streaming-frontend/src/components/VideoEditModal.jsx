import React, { useState, useEffect } from 'react';
import { X, Save, Lock, Users, Globe, Link2, AlertCircle, Loader2, Plus, Trash } from 'lucide-react';
import api from '../services/api';

const VideoEditModal = ({ video, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: [],
    visibility: 'public',
    allowedEmails: [],
    restrictionNote: ''
  });
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailInput, setEmailInput] = useState('');

  useEffect(() => {
    if (video) {
      setFormData({
        title: video.title || '',
        description: video.description || '',
        tags: video.tags || [],
        visibility: video.visibility || 'public',
        allowedEmails: video.allowedEmails || [],
        restrictionNote: video.restrictionNote || ''
      });
    }
  }, [video]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (formData.visibility === 'restricted' && formData.allowedEmails.length === 0) {
      setError('Please add at least one email for restricted access');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Update basic info
      await api.put(`/videos/${video.id}`, {
        title: formData.title,
        description: formData.description,
        tags: formData.tags
      });

      // Update privacy settings
      await api.post(`/videos/${video.id}/privacy`, {
        visibility: formData.visibility,
        allowedUserEmails: formData.allowedEmails,
        restrictionNote: formData.restrictionNote
      });

      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update video');
    } finally {
      setLoading(false);
    }
  };

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    if (formData.allowedEmails.includes(email)) {
      setError('This email is already added');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      allowedEmails: [...prev.allowedEmails, email]
    }));
    setEmailInput('');
    setError('');
  };

  const removeEmail = (email) => {
    setFormData(prev => ({
      ...prev,
      allowedEmails: prev.allowedEmails.filter(e => e !== email)
    }));
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag) return;
    
    if (formData.tags.includes(tag)) {
      setError('This tag is already added');
      return;
    }
    
    if (formData.tags.length >= 10) {
      setError('Maximum 10 tags allowed');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      tags: [...prev.tags, tag]
    }));
    setTagInput('');
    setError('');
  };

  const removeTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const visibilityOptions = [
    { 
      value: 'public', 
      icon: Globe, 
      label: 'Public', 
      description: 'Everyone can see this video',
      color: 'text-green-600',
      borderColor: 'border-green-500',
      bgColor: 'bg-green-50'
    },
    { 
      value: 'unlisted', 
      icon: Link2, 
      label: 'Unlisted', 
      description: 'Anyone with the link can view',
      color: 'text-yellow-600',
      borderColor: 'border-yellow-500',
      bgColor: 'bg-yellow-50'
    },
    { 
      value: 'private', 
      icon: Lock, 
      label: 'Private', 
      description: 'Only admins can see',
      color: 'text-red-600',
      borderColor: 'border-red-500',
      bgColor: 'bg-red-50'
    },
    { 
      value: 'restricted', 
      icon: Users, 
      label: 'Restricted', 
      description: 'Only specific users can view',
      color: 'text-purple-600',
      borderColor: 'border-purple-500',
      bgColor: 'bg-purple-50'
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full my-8 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-5 flex items-center justify-between rounded-t-xl">
          <h2 className="text-2xl font-bold flex items-center space-x-2">
            <Save className="h-6 w-6" />
            <span>Edit Video</span>
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Video Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Enter an engaging title..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">{formData.title.length}/100 characters</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={5}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              placeholder="Tell viewers about your video..."
            />
            <p className="text-xs text-gray-500 mt-1">{formData.description.length}/5000 characters</p>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tags (Optional)
            </label>
            <div className="flex space-x-2 mb-3">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add a tag..."
                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1"
              >
                <Plus className="h-4 w-4" />
                <span>Add</span>
              </button>
            </div>

            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center space-x-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">{formData.tags.length}/10 tags</p>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Who can watch this video?
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibilityOptions.map(option => {
                const Icon = option.icon;
                const isSelected = formData.visibility === option.value;
                return (
                  <label
                    key={option.value}
                    className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? `${option.borderColor} ${option.bgColor} shadow-md`
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={option.value}
                      checked={isSelected}
                      onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                      className="sr-only"
                    />
                    <Icon className={`h-6 w-6 ${isSelected ? option.color : 'text-gray-400'} mt-0.5 flex-shrink-0`} />
                    <div className="ml-3 flex-1">
                      <span className={`font-semibold block ${isSelected ? option.color : 'text-gray-900'}`}>
                        {option.label}
                      </span>
                      <span className="text-sm text-gray-600 block mt-0.5">
                        {option.description}
                      </span>
                    </div>
                    {isSelected && (
                      <div className={`absolute top-2 right-2 w-5 h-5 rounded-full ${option.color} bg-current flex items-center justify-center`}>
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Restricted Access Email List */}
          {formData.visibility === 'restricted' && (
            <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-5">
              <label className="block text-sm font-semibold text-purple-900 mb-3 flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Allowed Users *</span>
              </label>
              
              <div className="flex space-x-2 mb-4">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                  placeholder="user@example.com"
                  className="flex-1 px-4 py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={addEmail}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-1"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add</span>
                </button>
              </div>

              {formData.allowedEmails.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {formData.allowedEmails.map(email => (
                    <div key={email} className="flex items-center justify-between bg-white px-4 py-2 rounded-lg border border-purple-200">
                      <span className="text-sm text-gray-900">{email}</span>
                      <button
                        type="button"
                        onClick={() => removeEmail(email)}
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-white rounded-lg border-2 border-dashed border-purple-200">
                  <Users className="h-8 w-8 text-purple-300 mx-auto mb-2" />
                  <p className="text-sm text-purple-600">No users added yet</p>
                  <p className="text-xs text-purple-500 mt-1">Add email addresses above</p>
                </div>
              )}

              <div className="mt-4">
                <label className="block text-sm font-medium text-purple-900 mb-2">
                  Restriction Note (Optional)
                </label>
                <input
                  type="text"
                  value={formData.restrictionNote}
                  onChange={(e) => setFormData({ ...formData, restrictionNote: e.target.value })}
                  placeholder="e.g., 'Team members only'"
                  className="w-full px-4 py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-xl border-t">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium shadow-md transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoEditModal;