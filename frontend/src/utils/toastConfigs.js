/**
 * Pre-configured toast configurations for common operations
 */

export const toastConfigs = {
  auth: {
    loading: {
      type: 'loading',
      message: 'Authenticating...'
    },
    success: {
      type: 'success',
      message: 'Authentication successful!',
      duration: 2000
    },
    error: {
      type: 'error',
      message: 'Authentication failed',
      duration: 4000
    }
  },
  goal: {
    create: {
      loading: 'Creating goal...',
      success: 'Goal created successfully!',
      error: 'Failed to create goal'
    },
    update: {
      loading: 'Updating goal...',
      success: 'Goal updated successfully!',
      error: 'Failed to update goal'
    },
    delete: {
      loading: 'Deleting goal...',
      success: 'Goal deleted successfully!',
      error: 'Failed to delete goal'
    },
    toggle: {
      loading: 'Saving...',
      success: 'Saved successfully!',
      error: 'Failed to save'
    }
  },
  habit: {
    create: {
      loading: 'Creating habit...',
      success: 'Habit created successfully!',
      error: 'Failed to create habit'
    },
    update: {
      loading: 'Updating habit...',
      success: 'Habit updated successfully!',
      error: 'Failed to update habit'
    },
    delete: {
      loading: 'Deleting habit...',
      success: 'Habit deleted successfully!',
      error: 'Failed to delete habit'
    },
    log: {
      loading: 'Logging habit...',
      success: 'Habit logged successfully!',
      error: 'Failed to log habit'
    }
  },
  tag: {
    create: {
      loading: 'Creating tag...',
      success: 'Tag created successfully!',
      error: 'Failed to create tag'
    },
    update: {
      loading: 'Updating tag...',
      success: 'Tag updated successfully!',
      error: 'Failed to update tag'
    },
    delete: {
      loading: 'Deleting tag...',
      success: 'Tag deleted successfully!',
      error: 'Failed to delete tag'
    }
  }
};

/**
 * Wrapper function for async operations with toast notifications
 * 
 * @param {Function} operation - The async function to execute
 * @param {Object} toastFunctions - { showToast, updateToast }
 * @param {Object} config - { loading, success, error }
 * @returns {Promise<{success: boolean, data?: any, error?: any}>}
 * 
 * Example:
 * const result = await executeWithToast(
 *   () => fetch(...).then(r => r.json()),
 *   { showToast, updateToast },
 *   toastConfigs.goal.create
 * );
 */
export const executeWithToast = async (operation, toastFunctions, config) => {
  const { showToast, updateToast } = toastFunctions;
  const { loading, success, error } = config;

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
    console.error('Operation failed:', err);
    return { success: false, error: err };
  }
};
