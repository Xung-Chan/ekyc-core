import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectBackImage,
  selectEkycError,
  selectEkycLoading,
  selectFrontImage,
  selectOcrData,
  setFrontImage as setFrontImageAction,
  setBackImage as setBackImageAction,
  getOcrRequested,
} from '../state/ekyc.slice';
import { useCallback } from 'react';

const getFileInfoFromUri = (uri: string, defaultName: string) => {
  const filename = uri.split('/').pop()?.split('?')[0] || defaultName;
  const extension = filename.split('.').pop()?.toLowerCase();

  let type = 'image/jpeg';
  if (extension === 'png') {
    type = 'image/png';
  } else if (extension === 'webp') {
    type = 'image/webp';
  } else if (extension === 'heic' || extension === 'heif') {
    type = 'image/heic';
  } else if (extension === 'gif') {
    type = 'image/gif';
  }

  return { name: filename, type };
};

export const useEkycVM = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();

  const loading = useSelector(selectEkycLoading);
  const error = useSelector(selectEkycError);
  const frontImage = useSelector(selectFrontImage);
  const backImage = useSelector(selectBackImage);
  const ocrData = useSelector(selectOcrData);

  const setFrontImage = useCallback(
    (uri: string | null) => {
      if (uri) {
        const formattedUri = uri.startsWith('file://') ? uri : `file://${uri}`;
        const { name, type } = getFileInfoFromUri(
          formattedUri,
          'front_image.jpg'
        );
        dispatch(setFrontImageAction({ uri: formattedUri, name, type }));
      } else {
        dispatch(setFrontImageAction(null));
      }
    },
    [dispatch]
  );

  const setBackImage = useCallback(
    (uri: string | null) => {
      if (uri) {
        const formattedUri = uri.startsWith('file://') ? uri : `file://${uri}`;
        const { name, type } = getFileInfoFromUri(
          formattedUri,
          'back_image.jpg'
        );
        dispatch(setBackImageAction({ uri: formattedUri, name, type }));
      } else {
        dispatch(setBackImageAction(null));
      }
    },
    [dispatch]
  );

  const getOcr = useCallback(() => {
    if (frontImage && backImage) {
      dispatch(
        getOcrRequested({
          frontSide: frontImage,
          backSide: backImage,
        })
      );
    }
  }, [dispatch, frontImage, backImage]);

  const navigateToPreview = useCallback(() => {
    navigation.navigate('CCCDCapturePreview');
  }, [navigation]);

  const navigateToOcr = useCallback(() => {
    navigation.navigate('CCCDOcr');
  }, [navigation]);

  const navigateToCapture = useCallback(() => {
    navigation.navigate('CCCDCapture');
  }, [navigation]);

  return {
    loading,
    error,
    ocrData,
    frontImage,
    backImage,
    setBackImage,
    setFrontImage,
    getOcr,
    navigateToPreview,
    navigateToOcr,
    navigateToCapture,
  };
};
