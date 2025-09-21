import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  timeout: 15000
});

export const api = {
  async get(path, params) {
    const res = await http.get(path, { params });
    return res.data;
  }
};
