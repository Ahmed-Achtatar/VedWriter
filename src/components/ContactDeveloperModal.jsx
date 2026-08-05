import React from 'react';
import { Mail, MessageCircle, X } from 'lucide-react';

const DEVELOPER_EMAIL = 'ahmedacht2017@gmail.com';
const DEVELOPER_WHATSAPP = '+212706235893';

export default function ContactDeveloperModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal contact-developer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-developer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="contact-developer-eyebrow">CONTACT DEVELOPER</span>
            <h3 id="contact-developer-title">Let’s talk</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close contact dialog">
            <X size={17} />
          </button>
        </div>

        <div className="modal-body">
          <p className="contact-developer-intro">
            Have a question, suggestion, or need help with VedWriter? Reach out directly.
          </p>

          <div className="contact-developer-options">
            <a className="contact-developer-link" href={`mailto:${DEVELOPER_EMAIL}`}>
              <span className="contact-developer-link-icon"><Mail size={17} /></span>
              <span>
                <strong>Email</strong>
                <small>{DEVELOPER_EMAIL}</small>
              </span>
            </a>

            <a
              className="contact-developer-link"
              href="https://wa.me/212706235893"
              target="_blank"
              rel="noreferrer"
            >
              <span className="contact-developer-link-icon"><MessageCircle size={17} /></span>
              <span>
                <strong>WhatsApp</strong>
                <small>{DEVELOPER_WHATSAPP}</small>
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
