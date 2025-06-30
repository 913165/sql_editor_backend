import React, { useState, useEffect, useRef } from 'react';

const RealSQLEditor = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [connectionModal, setConnectionModal] = useState(false);
  const [connection, setConnection] = useState(null);
  const [queryHistory, setQueryHistory] = useState([]);
  const [status, setStatus] = useState('Ready - No database connected');
  const [schemas, setSchemas] = useState([]);
  const [error, setError] = useState(null);

  // Connection form state
  const [connectionForm, setConnectionForm] = useState({
    name: 'Local Database',
    type: 'mysql',
    host: 'localhost',
    port: '3306',
    username: '',
    password: '',
    database: ''
  });

  const [connectionStatus, setConnectionStatus] = useState({
    status: 'disconnected',
    message: 'Not connected to any database',
    isLoading: false
  });

  const API_BASE = 'http://localhost:3001';

  // Update port when database type changes
  const handleConnectionTypeChange = (type) => {
    const defaultPorts = {
      mysql: '3306',
      postgresql: '5432',
      oracle: '1521',
      sqlserver: '1433'
    };

    setConnectionForm(prev => ({
      ...prev,
      type,
      port: defaultPorts[type] || '3306'
    }));
  };

  // Test database connection - REAL CONNECTION ONLY
  const testConnection = async () => {
    if (!connectionForm.host || !connectionForm.username) {
      setConnectionStatus({
        status: 'error',
        message: 'Please fill in Host and Username fields',
        isLoading: false
      });
      return;
    }

    setConnectionStatus({
      status: 'testing',
      message: 'Testing connection to database...',
      isLoading: true
    });

    try {
      const response = await fetch(`${API_BASE}/api/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(connectionForm)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setConnectionStatus({
          status: 'connected',
          message: `✅ Successfully connected to ${connectionForm.type} database`,
          isLoading: false
        });

        if (result.schemas) {
          setSchemas(result.schemas);
        }
      } else {
        setConnectionStatus({
          status: 'error',
          message: `❌ Connection failed: ${result.error || 'Unknown error'}`,
          isLoading: false
        });
      }
    } catch (error) {
      setConnectionStatus({
        status: 'error',
        message: `❌ Cannot connect to database: ${error.message}. Make sure your backend API is running on ${API_BASE}`,
        isLoading: false
      });
    }
  };

  // Save and establish database connection
  const saveConnection = async () => {
    if (connectionStatus.status !== 'connected') {
      alert('Please test the connection successfully first');
      return;
    }

    setConnection(connectionForm);
    setConnectionModal(false);
    setStatus(`Connected to ${connectionForm.name} (${connectionForm.host}:${connectionForm.port})`);

    await fetchDatabaseSchemas();
  };

  // Fetch real database schemas
  const fetchDatabaseSchemas = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/get-schemas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(connectionForm)
      });

      const result = await response.json();
      if (result.success && result.schemas) {
        setSchemas(result.schemas);
      }
    } catch (error) {
      console.error('Failed to fetch schemas:', error);
    }
  };

  // Execute REAL SQL query against connected database
  const executeQuery = async () => {
    if (!query.trim()) {
      setError('Please enter a SQL query');
      return;
    }

    if (!connection) {
      setError('Please connect to a database first');
      setConnectionModal(true);
      return;
    }

    setIsExecuting(true);
    setStatus('Executing query against database...');
    setError(null);
    setResults(null);

    try {
      const response = await fetch(`${API_BASE}/api/execute-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connection: connection,
          query: query.trim()
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setResults(result);
        addToHistory(query);

        if (result.type === 'select') {
          setStatus(`✅ Query executed successfully - ${result.rowCount} rows returned in ${result.executionTime}`);
        } else {
          setStatus(`✅ Query executed successfully - ${result.rowCount} rows affected in ${result.executionTime}`);
        }
      } else {
        throw new Error(result.error || 'Query execution failed');
      }
    } catch (error) {
      setError(`Query execution failed: ${error.message}`);
      setStatus('Query execution failed');
    }

    setIsExecuting(false);
  };

  // Add query to history
  const addToHistory = (query) => {
    const timestamp = new Date().toLocaleTimeString();
    setQueryHistory(prev => [
      { query: query.substring(0, 100) + (query.length > 100 ? '...' : ''), timestamp },
      ...prev.slice(0, 9)
    ]);
  };

  // Format SQL query
  const formatQuery = () => {
    if (!query.trim()) return;

    const formatted = query
        .replace(/\s+/g, ' ')
        .replace(/,/g, ',\n    ')
        .replace(/\bFROM\b/gi, '\nFROM')
        .replace(/\bWHERE\b/gi, '\nWHERE')
        .replace(/\bJOIN\b/gi, '\nJOIN')
        .replace(/\bLEFT JOIN\b/gi, '\nLEFT JOIN')
        .replace(/\bRIGHT JOIN\b/gi, '\nRIGHT JOIN')
        .replace(/\bINNER JOIN\b/gi, '\nINNER JOIN')
        .replace(/\bORDER BY\b/gi, '\nORDER BY')
        .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
        .replace(/\bHAVING\b/gi, '\nHAVING')
        .replace(/\bSELECT\b/gi, 'SELECT')
        .trim();

    setQuery(formatted);
    setStatus('Query formatted');
  };

  // Clear editor
  const clearEditor = () => {
    if (window.confirm('Are you sure you want to clear the editor?')) {
      setQuery('');
      setResults(null);
      setError(null);
      setStatus('Editor cleared');
    }
  };

  // Generate SQL using AI
  const generateSQL = async () => {
    if (!aiInput.trim()) {
      setError('Please describe what you want to query');
      return;
    }

    setStatus('Generating SQL with AI...');

    try {
      const response = await fetch(`${API_BASE}/api/generate-sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: aiInput,
          schema: schemas,
          database_type: connection?.type
        })
      });

      const result = await response.json();

      if (result.success) {
        setQuery(result.sql);
        setAiInput('');
        setStatus('SQL generated by AI');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      setError(`AI generation failed: ${error.message}. Feature requires AI API setup.`);
      setStatus('AI generation failed');
    }
  };

  // Export functions
  const exportToCSV = () => {
    if (!results || !results.data) return;

    const headers = Object.keys(results.data[0]);
    const csvContent = [
      headers.join(','),
      ...results.data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query_results.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    if (!results || !results.data) return;

    const jsonContent = JSON.stringify(results.data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query_results.json';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '15px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            padding: '24px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                backgroundColor: '#667eea',
                color: 'white',
                fontSize: '24px',
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                🗄️
              </div>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#667eea', margin: 0 }}>
                Real SQL Editor
              </h1>
              <span style={{
                padding: '6px 12px',
                background: '#d4edda',
                color: '#155724',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '500'
              }}>
              Production Ready
            </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', color: '#666' }}>AI Assistant</span>
              <button
                  onClick={() => setAiEnabled(!aiEnabled)}
                  style={{
                    position: 'relative',
                    width: '50px',
                    height: '25px',
                    backgroundColor: aiEnabled ? '#667eea' : '#ccc',
                    borderRadius: '25px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    border: 'none'
                  }}
              >
                <div style={{
                  position: 'absolute',
                  width: '21px',
                  height: '21px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  top: '2px',
                  left: aiEnabled ? '27px' : '2px',
                  transition: 'all 0.3s ease'
                }}></div>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', minHeight: 'calc(100vh - 200px)' }}>
            {/* Main Editor Panel */}
            <div style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '15px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {/* Toolbar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <button
                    onClick={() => setConnectionModal(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 20px',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '14px',
                      transition: 'all 0.3s ease',
                      backgroundColor: '#667eea',
                      color: 'white'
                    }}
                >
                  🔗 Connect Database
                </button>

                <button
                    onClick={executeQuery}
                    disabled={isExecuting || !connection}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 20px',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isExecuting || !connection ? 'not-allowed' : 'pointer',
                      fontWeight: '500',
                      fontSize: '14px',
                      transition: 'all 0.3s ease',
                      backgroundColor: isExecuting || !connection ? '#6c757d' : '#28a745',
                      color: 'white',
                      opacity: isExecuting || !connection ? 0.6 : 1
                    }}
                >
                  {isExecuting ? '⏳' : '▶️'} Execute Query
                </button>

                <button
                    onClick={formatQuery}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 20px',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '14px',
                      transition: 'all 0.3s ease',
                      backgroundColor: '#6f42c1',
                      color: 'white'
                    }}
                >
                  🎨 Format SQL
                </button>

                <button
                    onClick={clearEditor}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 20px',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '14px',
                      transition: 'all 0.3s ease',
                      backgroundColor: '#dc3545',
                      color: 'white'
                    }}
                >
                  🗑️ Clear
                </button>
              </div>

              {/* SQL Editor */}
              <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="-- Enter your SQL query here&#10;-- Example: SELECT * FROM users WHERE active = 1;"
                  style={{
                    width: '100%',
                    height: '250px',
                    padding: '16px',
                    backgroundColor: '#1e1e1e',
                    color: '#00ff00',
                    fontFamily: 'Courier New, monospace',
                    fontSize: '14px',
                    borderRadius: '8px',
                    border: '2px solid #e9ecef',
                    resize: 'vertical',
                    outline: 'none'
                  }}
              />

              {/* Error Display */}
              {error && (
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#f8d7da',
                    border: '1px solid #f5c6cb',
                    borderRadius: '8px',
                    color: '#721c24',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '18px' }}>⚠️</span>
                    <div>
                      <strong>Error:</strong>
                      <div style={{ marginTop: '4px' }}>{error}</div>
                    </div>
                  </div>
              )}

              {/* Results Panel */}
              {results && (
                  <div style={{
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: 'white'
                  }}>
                    <div style={{
                      padding: '12px 16px',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      color: 'white',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontWeight: '500'
                    }}>
                      <span>Query Results ({results.rowCount} rows)</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={exportToCSV}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: 'rgba(255, 255, 255, 0.2)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                        >
                          Export CSV
                        </button>
                        <button
                            onClick={exportToJSON}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: 'rgba(255, 255, 255, 0.2)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                        >
                          Export JSON
                        </button>
                      </div>
                    </div>

                    {results.type === 'select' && results.data && results.data.length > 0 ? (
                        <div style={{ overflow: 'auto', maxHeight: '400px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                            <tr>
                              {Object.keys(results.data[0]).map((column) => (
                                  <th key={column} style={{
                                    padding: '12px',
                                    textAlign: 'left',
                                    fontWeight: '600',
                                    backgroundColor: '#f8f9fa',
                                    color: '#495057',
                                    borderBottom: '2px solid #dee2e6',
                                    position: 'sticky',
                                    top: 0
                                  }}>
                                    {column}
                                  </th>
                              ))}
                            </tr>
                            </thead>
                            <tbody>
                            {results.data.map((row, index) => (
                                <tr key={index} style={{
                                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                                }}>
                                  {Object.values(row).map((value, colIndex) => (
                                      <td key={colIndex} style={{
                                        padding: '10px 12px',
                                        borderBottom: '1px solid #dee2e6',
                                        color: '#333'
                                      }}>
                                        {value === null ? (
                                            <span style={{ color: '#999', fontStyle: 'italic' }}>NULL</span>
                                        ) : typeof value === 'boolean' ? (
                                            <span style={{ color: value ? '#28a745' : '#dc3545' }}>
                                    {value.toString()}
                                  </span>
                                        ) : (
                                            value.toString()
                                        )}
                                      </td>
                                  ))}
                                </tr>
                            ))}
                            </tbody>
                          </table>
                        </div>
                    ) : results.type === 'select' ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6c757d' }}>
                          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📊</div>
                          <p>Query executed successfully but returned no rows</p>
                        </div>
                    ) : (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#28a745' }}>
                          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                          <p style={{ fontWeight: '500' }}>{results.message}</p>
                        </div>
                    )}

                    <div style={{
                      padding: '12px 16px',
                      backgroundColor: '#f8f9fa',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '14px',
                      color: '#6c757d'
                    }}>
                      <span style={{ color: '#28a745' }}>✓ Executed in {results.executionTime}</span>
                    </div>
                  </div>
              )}

              {/* Status Bar */}
              <div style={{
                padding: '12px 16px',
                backgroundColor: '#f8f9fa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '14px',
                color: '#6c757d',
                borderRadius: '8px'
              }}>
                <span>{status}</span>
                <span>
                Lines: {query.split('\n').length} | Characters: {query.length}
              </span>
              </div>
            </div>

            {/* AI Assistant Panel */}
            {aiEnabled && (
                <div style={{
                  width: '400px',
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '15px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#667eea',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    🤖 AI Assistant
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
                      Describe your query:
                    </label>
                    <textarea
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        placeholder="e.g., Find all active users with their order counts"
                        style={{
                          padding: '12px',
                          border: '2px solid #e9ecef',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'border-color 0.3s ease',
                          height: '80px',
                          resize: 'vertical'
                        }}
                    />
                    <button
                        onClick={generateSQL}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          padding: '12px 20px',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          fontSize: '14px',
                          transition: 'all 0.3s ease',
                          backgroundColor: '#667eea',
                          color: 'white'
                        }}
                    >
                      Generate SQL
                    </button>
                  </div>

                  {/* Database Schema */}
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: '500', color: '#333', marginBottom: '8px' }}>
                      Database Schema
                    </h4>
                    <div style={{
                      maxHeight: '250px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      {schemas.length > 0 ? (
                          schemas.map((table, index) => (
                              <div key={index} style={{
                                padding: '12px',
                                backgroundColor: '#f8f9fa',
                                border: '1px solid #e9ecef',
                                borderRadius: '6px'
                              }}>
                                <div style={{
                                  fontWeight: '500',
                                  color: '#667eea',
                                  marginBottom: '4px'
                                }}>
                                  {table.tableName}
                                </div>
                                <div style={{ fontSize: '12px', color: '#6c757d' }}>
                                  {table.columns}
                                </div>
                              </div>
                          ))
                      ) : (
                          <p style={{ color: '#999', fontSize: '14px' }}>
                            Connect to database to see schema
                          </p>
                      )}
                    </div>
                  </div>

                  {/* Query History */}
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: '500', color: '#333', marginBottom: '8px' }}>
                      Recent Queries
                    </h4>
                    <div style={{
                      maxHeight: '200px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      {queryHistory.map((item, index) => (
                          <div
                              key={index}
                              onClick={() => setQuery(item.query)}
                              style={{
                                padding: '8px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                transition: 'background-color 0.3s ease'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#e9ecef'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                          >
                            <div style={{
                              fontFamily: 'monospace',
                              color: '#333',
                              marginBottom: '2px'
                            }}>
                              {item.query}
                            </div>
                            <div style={{ color: '#999' }}>{item.timestamp}</div>
                          </div>
                      ))}
                    </div>
                  </div>
                </div>
            )}
          </div>

          {/* Connection Modal */}
          {connectionModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '15px',
                  padding: '24px',
                  width: '90%',
                  maxWidth: '600px',
                  maxHeight: '80vh',
                  overflow: 'auto'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px'
                  }}>
                    <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#333', margin: 0 }}>
                      Database Connection
                    </h3>
                    <button
                        onClick={() => setConnectionModal(false)}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '24px',
                          cursor: 'pointer',
                          color: '#999',
                          padding: '0',
                          width: '30px',
                          height: '30px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#333', marginBottom: '4px' }}>
                        Connection Name
                      </label>
                      <input
                          type="text"
                          value={connectionForm.name}
                          onChange={(e) => setConnectionForm({...connectionForm, name: e.target.value})}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#333', marginBottom: '4px' }}>
                          Database Type
                        </label>
                        <select
                            value={connectionForm.type}
                            onChange={(e) => handleConnectionTypeChange(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #ccc',
                              borderRadius: '4px',
                              fontSize: '14px'
                            }}
                        >
                          <option value="mysql">MySQL</option>
                          <option value="postgresql">PostgreSQL</option>
                          <option value="oracle">Oracle</option>
                          <option value="sqlserver">SQL Server</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#333', marginBottom: '4px' }}>
                          Port
                        </label>
                        <input
                            type="text"
                            value={connectionForm.port}
                            onChange={(e) => setConnectionForm({...connectionForm, port: e.target.value})}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #ccc',
                              borderRadius: '4px',
                              fontSize: '14px'
                            }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#333', marginBottom: '4px' }}>
                        Host
                      </label>
                      <input
                          type="text"
                          value={connectionForm.host}
                          onChange={(e) => setConnectionForm({...connectionForm, host: e.target.value})}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#333', marginBottom: '4px' }}>
                          Username
                        </label>
                        <input
                            type="text"
                            value={connectionForm.username}
                            onChange={(e) => setConnectionForm({...connectionForm, username: e.target.value})}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #ccc',
                              borderRadius: '4px',
                              fontSize: '14px'
                            }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#333', marginBottom: '4px' }}>
                          Password
                        </label>
                        <input
                            type="password"
                            value={connectionForm.password}
                            onChange={(e) => setConnectionForm({...connectionForm, password: e.target.value})}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #ccc',
                              borderRadius: '4px',
                              fontSize: '14px'
                            }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#333', marginBottom: '4px' }}>
                        Database Name (optional)
                      </label>
                      <input
                          type="text"
                          value={connectionForm.database}
                          onChange={(e) => setConnectionForm({...connectionForm, database: e.target.value})}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                      />
                    </div>

                    {/* Connection Status */}
                    <div style={{
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      ...(connectionStatus.status === 'connected' ? {
                        backgroundColor: '#d4edda',
                        border: '1px solid #c3e6cb',
                        color: '#155724'
                      } : connectionStatus.status === 'error' ? {
                        backgroundColor: '#f8d7da',
                        border: '1px solid #f5c6cb',
                        color: '#721c24'
                      } : connectionStatus.status === 'testing' ? {
                        backgroundColor: '#fff3cd',
                        border: '1px solid #ffeaa7',
                        color: '#856404'
                      } : {
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #dee2e6',
                        color: '#6c757d'
                      })
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {connectionStatus.isLoading && (
                            <div style={{
                              width: '16px',
                              height: '16px',
                              border: '2px solid #ccc',
                              borderTop: '2px solid #333',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite'
                            }}></div>
                        )}
                        <span style={{ fontSize: '14px', fontWeight: '500' }}>
                      {connectionStatus.message}
                    </span>
                      </div>
                    </div>

                    {/* API Setup Notice */}
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#cce7ff',
                      border: '1px solid #99d6ff',
                      borderRadius: '6px',
                      fontSize: '14px',
                      color: '#004085'
                    }}>
                      <strong>Backend API Required:</strong> This editor connects to real databases via API endpoints at {API_BASE}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    marginTop: '24px'
                  }}>
                    <button
                        onClick={testConnection}
                        disabled={connectionStatus.isLoading}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: connectionStatus.isLoading ? '#6c757d' : '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: connectionStatus.isLoading ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                    >
                      {connectionStatus.isLoading ? 'Testing...' : 'Test Connection'}
                    </button>
                    <button
                        onClick={() => setConnectionModal(false)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                    >
                      Cancel
                    </button>
                    <button
                        onClick={saveConnection}
                        disabled={connectionStatus.status !== 'connected'}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: connectionStatus.status !== 'connected' ? '#6c757d' : '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: connectionStatus.status !== 'connected' ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          opacity: connectionStatus.status !== 'connected' ? 0.6 : 1
                        }}
                    >
                      Save & Connect
                    </button>
                  </div>
                </div>
              </div>
          )}
        </div>

        <style>
          {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
        </style>
      </div>
  );
};

export default RealSQLEditor;