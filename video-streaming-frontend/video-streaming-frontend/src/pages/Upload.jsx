import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import videoService from '../services/videoService';
import Navbar from '../components/Navbar';
import { Upload, X, CheckCircle, AlertCircle, Globe, Lock, Link2, Users } from 'lucide-react';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const MAX_RETRIES = 3; // Maximum retries per chunk

const UploadPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [emailInput, setEmailInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploadedVideoId, setUploadedVideoId] = useState(null);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);

  const visibilityOptions = [
    { 
      value: 'public', 
      icon: Globe, 
      label: 'Public', 
      description: 'Everyone can see this video' 
    },
    { 
      value: 'unlisted', 
      icon: Link2, 
      label: 'Unlisted', 
      description: 'Anyone with the link can see' 
    },
    { 
      value: 'private', 
      icon: Lock, 
      label: 'Private', 
      description: 'Only admins can see' 
    },
    { 
      value: 'restricted', 
      icon: Users, 
      label: 'Restricted', 
      description: 'Only specific users can see' 
    }
  ];

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        setError('Please select a valid video file');
        return;
      }

      // Validate file size (max 10GB)
      const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
      if (file.size > maxSize) {
        setError('File size exceeds 10GB limit');
        return;
      }

      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      setError('');
    }
  };

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (!allowedEmails.includes(email)) {
        setAllowedEmails([...allowedEmails, email]);
        setEmailInput('');
      } else {
        setError('This email is already added');
      }
    } else if (email) {
      setError('Please enter a valid email address');
    }
  };

  const removeEmail = (email) => {
    setAllowedEmails(allowedEmails.filter(e => e !== email));
  };

  const uploadChunkWithRetry = async (chunk, chunkIndex, totalChunks, videoId) => {
    let retries = 0;
    
    while (retries < MAX_RETRIES) {
      try {
        await videoService.uploadChunk(chunk, chunkIndex, totalChunks, videoId);
        return; // Success, exit retry loop
      } catch (err) {
        retries++;
        console.warn(`[Upload] Chunk ${chunkIndex} failed, retry ${retries}/${MAX_RETRIES}`);
        
        if (retries === MAX_RETRIES) {
          throw new Error(`Failed to upload chunk ${chunkIndex + 1} after ${MAX_RETRIES} attempts`);
        }
        
        // Exponential backoff: wait 1s, 2s, 4s...
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
      }
    }
  };

  const uploadChunks = async (file) => {
    const chunks = Math.ceil(file.size / CHUNK_SIZE);
    setTotalChunks(chunks);
    
    try {
      // Initialize upload
      const initResponse = await videoService.initUpload(
        file.name,
        title,
        description,
        file.size,
        chunks
      );

      const videoId = initResponse.videoId;
      setUploadedVideoId(videoId);

      // Upload chunks with retry logic
      for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
        setCurrentChunk(chunkIndex + 1);
        
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        await uploadChunkWithRetry(chunk, chunkIndex, chunks, videoId);

        setUploadProgress(Math.round(((chunkIndex + 1) / chunks) * 100));
      }

      // Complete upload
      await videoService.completeUpload(videoId, chunks);

      // Set privacy settings if needed
      if (visibility !== 'public' || allowedEmails.length > 0) {
        await videoService.setPrivacy(videoId, {
          visibility,
          allowedUserEmails: allowedEmails
        });
      }
      
      setSuccess(true);
      setUploading(false);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || err.message || 'Upload failed. Please try again.');
      setUploading(false);
      setUploadProgress(0);
      setCurrentChunk(0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (visibility === 'restricted' && allowedEmails.length === 0) {
      setError('Please add at least one email for restricted access');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(0);
    setCurrentChunk(0);

    await uploadChunks(selectedFile);
  };

  const resetForm = () => {
    setSelectedFile(null);
    setTitle('');
    setDescription('');
    setVisibility('public');
    setAllowedEmails([]);
    setEmailInput('');
    setUploadProgress(0);
    setCurrentChunk(0);
    setTotalChunks(0);
    setError('');
    setSuccess(false);
    setUploadedVideoId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (success) {
    return (
      <>
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Successful!</h2>
            <p className="text-gray-600 mb-6">
              Your video is being processed. It will be available soon.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => navigate(`/video/${uploadedVideoId}`)}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                View Video
              </button>
              <button
                onClick={resetForm}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Upload Another
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Upload Video</h1>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video File *
              </label>
              
              {!selectedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors"
                >
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">Click to select a video file</p>
                  <p className="text-sm text-gray-400">MP4, AVI, MOV, MKV (Max 10GB)</p>
                </div>
              ) : (
                <div className="border border-gray-300 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-12 w-12 bg-primary-100 rounded flex items-center justify-center">
                      <Upload className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  {!uploading && (
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading}
              />
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
                maxLength={100}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100"
                placeholder="Enter video title"
                required
              />
              <p className="text-xs text-gray-500 mt-1">{title.length}/100 characters</p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={uploading}
                maxLength={5000}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 resize-none"
                placeholder="Describe your video"
              />
              <p className="text-xs text-gray-500 mt-1">{description.length}/5000 characters</p>
            </div>

            {/* Privacy Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Privacy Settings
              </label>
              <div className="space-y-2">
                {visibilityOptions.map(option => {
                  const Icon = option.icon;
                  return (
                    <label
                      key={option.value}
                      className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-all ${
                        visibility === option.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-300 hover:border-gray-400'
                      } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        value={option.value}
                        checked={visibility === option.value}
                        onChange={(e) => setVisibility(e.target.value)}
                        disabled={uploading}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Icon className="h-4 w-4" />
                          <span className="font-medium text-gray-900">{option.label}</span>
                        </div>
                        <p className="text-sm text-gray-600">{option.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Restricted Access Email List */}
            {visibility === 'restricted' && (
              <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-purple-900 mb-2">
                  Allowed Users (by email) *
                </label>
                
                <div className="flex space-x-2 mb-3">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addEmail();
                      }
                    }}
                    placeholder="user@example.com"
                    disabled={uploading}
                    className="flex-1 px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  />
                  <button
                    type="button"
                    onClick={addEmail}
                    disabled={uploading}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                </div>

                {allowedEmails.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {allowedEmails.map(email => (
                      <div key={email} className="flex items-center justify-between bg-white px-3 py-2 rounded border border-purple-200">
                        <span className="text-sm text-gray-900">{email}</span>
                        <button
                          type="button"
                          onClick={() => removeEmail(email)}
                          disabled={uploading}
                          className="text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-purple-600 text-center py-4 bg-white rounded border-2 border-dashed border-purple-200">
                    Add at least one email address for restricted access
                  </p>
                )}
              </div>
            )}

            {/* Upload Progress */}
            {uploading && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between text-sm text-gray-700 mb-2">
                  <span className="font-medium">Uploading...</span>
                  <span className="font-bold">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-primary-600 to-orange-600 h-3 rounded-full transition-all duration-300 shadow-inner"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                {totalChunks > 0 && (
                  <p className="text-xs text-gray-600 text-center">
                    Chunk {currentChunk} of {totalChunks}
                  </p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="flex-1 py-3 px-6 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-md"
              >
                {uploading ? 'Uploading...' : 'Upload Video'}
              </button>
              {!uploading && (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default UploadPage;