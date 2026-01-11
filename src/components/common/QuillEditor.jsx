import React, { forwardRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// ReactQuill을 forwardRef로 래핑하여 findDOMNode 경고 해결
const QuillEditor = forwardRef((props, ref) => {
  return <ReactQuill ref={ref} {...props} />;
});

QuillEditor.displayName = 'QuillEditor';

export default QuillEditor;
