import apiClient from './api';

const getProfile = async () => {
  const response = await apiClient.get('/users/me');
  return response.data;
};

const updateProfile = async (profileData) => {
  const response = await apiClient.put('/users/me', profileData);
  return response.data;
};

const uploadAvatar = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

const getUserProfile = async (username) => {
  const response = await apiClient.get(`/users/${username}`);
  return response.data;
};

const searchUsers = async (query) => {
  const response = await apiClient.get('/users/search', { params: { q: query } });
  return response.data;
};

const getStats = async () => {
  const response = await apiClient.get('/users/me/stats');
  return response.data;
};

const getPublicUsers = async (skip = 0, limit = 20, search = '') => {
  const params = { skip, limit };
  if (search) params.search = search;
  const response = await apiClient.get('/users/public', { params });
  return response.data;
};

const userService = {
  getProfile,
  updateProfile,
  uploadAvatar,
  getUserProfile,
  searchUsers,
  getStats,
  getPublicUsers
};

export default userService;
