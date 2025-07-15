import axios from 'axios';
import { useAuth } from './useAuth';
import { API } from '../utils/constants';

export const useApi = () => {
  const { token } = useAuth();
  
  const apiCall = async (method, endpoint, data = null) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };

    try {
      const response = await axios({
        method,
        url: `${API}/${endpoint}`,
        data,
        headers
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'An error occurred' 
      };
    }
  };

  return { apiCall };
};