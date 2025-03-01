import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';

function DataListComponent() {
  const [dataList, setDataList] = useState([]);

  useEffect(() => {
    const fetchDataList = async () => {
      try {
        const response = await apiClient.get('/data'); // Adjust endpoint as needed.
        setDataList(response.data);
      } catch (error) {
        console.error('Error fetching data list:', error);
      }
    };

    fetchDataList();
  }, []);

  return (
    <div>
      <h2>Data List</h2>
      <ul>
        {dataList.map((item, index) => (
          <li key={index}>
            <input type="checkbox" />
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DataListComponent;
