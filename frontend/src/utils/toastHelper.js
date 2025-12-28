/**
 * Toast API Helper
 * 
 * Usage in components:
 * 
 * const { showToast, updateToast } = useToast();
 * 
 * // For loading operations:
 * const { id } = showToast('Loading...', { type: 'loading' });
 * 
 * try {
 *   await fetch(url, options);
 *   updateToast(id, { type: 'success', message: 'Operation successful!' });
 * } catch (error) {
 *   updateToast(id, { type: 'error', message: 'Operation failed!' });
 * }
 */

export const handleAsyncOperation = async (
  operation,
  { showToast, updateToast },
  messages = {}
) => {
  const {
    loading = 'Processing...',
    success = 'Operation completed successfully!',
    error = 'Operation failed. Please try again.',
  } = messages;

  const { id } = showToast(loading, { type: 'loading' });

  try {
    const result = await operation();
    updateToast(id, {
      type: 'success',
      message: success,
      duration: 2000,
    });
    return { success: true, data: result };
  } catch (err) {
    updateToast(id, {
      type: 'error',
      message: error,
      duration: 4000,
    });
    console.error('Operation error:', err);
    return { success: false, error: err };
  }
};
