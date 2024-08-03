import React, { useState, useEffect } from 'react';
import axios from 'axios';

function DataListComponent() {
  const [dataList, setDataList] = useState([]);

  useEffect(() => {
    axios.get('/api/data')
      .then(response => setDataList(response.data))
      .catch(error => console.error(error));
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
};

export default DataListComponent;