import { useState, useEffect, useCallback } from 'react';

/**
 * 자동저장 Hook
 * @param {Object} data - 저장할 데이터
 * @param {string} key - LocalStorage 키
 * @param {number} interval - 자동저장 간격 (ms, 기본 30초)
 * @param {boolean} enabled - 자동저장 활성화 여부
 */
const useAutoSave = (data, key, interval = 30000, enabled = true) => {
  const [lastSaved, setLastSaved] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // 데이터가 비어있는지 확인
  const isEmpty = useCallback(() => {
    if (!data) return true;
    
    // 기본 필드 체크
    const { formData, selectedParts = [], tags = [] } = data;
    if (!formData) return true;
    
    // 중요 필드가 하나라도 있으면 저장
    const hasContent = 
      formData.customer_name?.trim() ||
      formData.customer_phone?.trim() ||
      formData.symptom?.trim() ||
      formData.solution?.trim() ||
      selectedParts.length > 0 ||
      tags.length > 0;
    
    return !hasContent;
  }, [data]);

  // 저장 함수
  const save = useCallback(() => {
    if (!enabled || isEmpty()) {
      return;
    }

    try {
      setIsSaving(true);
      const saveData = {
        ...data,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(key, JSON.stringify(saveData));
      setLastSaved(new Date());
      console.log(`[AutoSave] ${key} 저장 완료 - ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error('[AutoSave] 저장 실패:', err);
    } finally {
      setIsSaving(false);
    }
  }, [data, key, enabled, isEmpty]);

  // 복구 함수
  const restore = useCallback(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsedData = JSON.parse(saved);
        console.log(`[AutoSave] ${key} 복구됨:`, parsedData.timestamp);
        return parsedData;
      }
    } catch (err) {
      console.error('[AutoSave] 복구 실패:', err);
    }
    return null;
  }, [key]);

  // 삭제 함수
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setLastSaved(null);
      console.log(`[AutoSave] ${key} 삭제됨`);
    } catch (err) {
      console.error('[AutoSave] 삭제 실패:', err);
    }
  }, [key]);

  // 자동저장 타이머
  useEffect(() => {
    if (!enabled || isEmpty()) {
      return;
    }

    const timer = setInterval(() => {
      save();
    }, interval);

    return () => clearInterval(timer);
  }, [enabled, isEmpty, save, interval]);

  return {
    lastSaved,
    isSaving,
    save,
    restore,
    clear
  };
};

export default useAutoSave;

