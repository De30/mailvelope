/**
 * Copyright (C) 2012-2019 Mailvelope GmbH
 * Licensed under the GNU Affero General Public License version 3
 */

import React from 'react';
import PropTypes from 'prop-types';
import {Link} from 'react-router-dom';
import {port, getAppDataSlot} from '../app';
import {matchPattern2RegExString} from '../../lib/util';
import * as l10n from '../../lib/l10n';
import Trans from '../../components/util/Trans';
import Alert from '../../components/util/Alert';
import Modal from '../../components/util/Modal';

const GMAIL_SCOPE_READONLY = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_SCOPE_SEND = 'https://www.googleapis.com/auth/gmail.send';

l10n.register([
  'alert_header_important',
  'alert_header_warning',
  'dialog_popup_close',
  'form_cancel',
  'form_save',
  'keygrid_user_email',
  'provider_gmail_auth',
  'provider_gmail_auth_cancel_btn',
  'provider_gmail_auth_readonly',
  'provider_gmail_auth_send',
  'provider_gmail_auth_table_title',
  'provider_gmail_dialog_auth_google_signin',
  'provider_gmail_dialog_auth_intro',
  'provider_gmail_dialog_auth_outro',
  'provider_gmail_dialog_description',
  'provider_gmail_dialog_privacy_policy',
  'provider_gmail_dialog_title',
  'provider_gmail_integration',
  'provider_gmail_integration_info',
  'provider_gmail_integration_warning',
  'settings_provider'
]);

const GMAIL_MATCH_PATTERN = '*.mail.google.com';

export default class Provider extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      gmail: false, // Gmail registered in authorized domains
      gmail_integration: false,
      gmail_authorized_emails: [],
      email: '',
      scopes: [],
      gmailCtrlId: '',
      watchList: null,
      modified: false,
    };
    this.handleCheck = this.handleCheck.bind(this);
    this.handleSave = this.handleSave.bind(this);
    this.handleCancel = this.handleCancel.bind(this);
  }

  componentDidMount() {
    this.loadPrefs().then(() => {
      if (/\/auth$/.test(this.props.location.pathname)) {
        getAppDataSlot()
        .then(data => this.openOAuthDialog(data));
      }
    });
  }

  openOAuthDialog({email, scopes, gmailCtrlId}) {
    this.setState({showAuthModal: true, email, scopes, gmailCtrlId});
  }

  async getAuthorization() {
    try {
      const {email, scopes, gmailCtrlId} = this.state;
      await port.send('authorize-gmail', {email, scopes, gmailCtrlId});
      await this.loadAuthorisations();
    } catch (error) {
      this.props.onSetNotification({header: l10n.map.alert_header_warning, message: error.message, type: 'error', hideDelay: 10000});
    } finally {
      this.setState({showAuthModal: false});
    }
  }

  getAuthText(authorisation) {
    let text;
    switch (authorisation) {
      case GMAIL_SCOPE_READONLY:
        text = l10n.map.provider_gmail_auth_readonly;
        break;
      case GMAIL_SCOPE_SEND:
        text = l10n.map.provider_gmail_auth_send;
        break;
      default:
        text = '';
    }
    return text;
  }

  async loadPrefs() {
    const {provider} = await port.send('get-prefs');
    const gmail = await this.verifyHost(GMAIL_MATCH_PATTERN);
    this.setState({
      gmail,
      gmail_integration: provider.gmail_integration,
      modified: false
    });
    await this.loadAuthorisations();
  }

  async verifyHost(host) {
    if (!this.state.watchList) {
      await this.loadWatchList();
    }
    const regex = new RegExp(matchPattern2RegExString(host));
    const match = this.state.watchList.some(({active, frames}) => active && frames.some(({scan, frame}) => scan && regex.test((frame))));
    return match;
  }

  async loadAuthorisations() {
    let gmailOAuthTokens = await port.send('get-oauth-tokens', {provider: 'gmail'});
    if (gmailOAuthTokens) {
      gmailOAuthTokens = Object.keys(gmailOAuthTokens).map(key => ({...gmailOAuthTokens[key], email: key}));
    } else {
      gmailOAuthTokens = [];
    }
    this.setState({gmail_authorized_emails: gmailOAuthTokens});
  }

  async loadWatchList() {
    const watchList = await port.send('getWatchList');
    this.setState({watchList});
  }

  async removeAuthorisation(email) {
    await port.send('remove-oauth-token', {provider: 'gmail', email});
    await this.loadAuthorisations();
  }

  handleCheck({target}) {
    this.setState({[target.name]: target.checked, modified: true});
  }

  async handleSave() {
    const update = {
      provider: {
        gmail_integration: this.state.gmail_integration,
      }
    };
    await port.send('set-prefs', {prefs: update});
    this.setState({modified: false});
  }

  handleCancel() {
    this.loadPrefs();
  }

  authModal() {
    return (
      <Modal
        isOpen={this.state.showAuthModal}
        toggle={() => this.setState(prevState => ({showAuthModal: !prevState.showAuthModal}))}
        size="medium"
        title={l10n.map.provider_gmail_dialog_title}
        footer={
          <div className="modal-footer justify-content-between">
            <button type="button" className="btn btn-secondary" onClick={() => this.setState({showAuthModal: false, gmail_integration: false}, () => this.handleSave())}>{l10n.map.dialog_popup_close}</button>
            <button type="button" className="btn btn-light google-sign-in-btn" onClick={() => this.getAuthorization()}><img src="../../../img/btn_google_light_normal_ios.svg" />{l10n.map.provider_gmail_dialog_auth_google_signin}</button>
          </div>
        }
      >
        <>
          <p><span>{l10n.map.provider_gmail_dialog_description}</span> <a href="https://www.mailvelope.com/de/faq#gmail_permissions" target="_blank" rel="noopener noreferrer">{l10n.map.learn_more_link}</a></p>
          <p><Trans id={l10n.map.provider_gmail_dialog_auth_intro} components={[<strong key="0">{this.state.email}</strong>]} /></p>
          <ul>
            {this.state.scopes.map((entry, index) =>
              <li key={index}>
                {this.getAuthText(entry)}
              </li>
            )}
          </ul>
          <p><Trans id={l10n.map.provider_gmail_dialog_auth_outro} components={[<strong key="0">{this.state.email}</strong>]} /></p>
          <p className="text-muted text-right">
            <small>
              <Trans id={l10n.map.provider_gmail_dialog_privacy_policy} components={[
                <a key="0" href="https://www.mailvelope.com/en/privacy-policy" className="text-reset" target="_blank" rel="noopener noreferrer"></a>
              ]} />
            </small>
          </p>
        </>
      </Modal>
    );
  }

  render() {
    return (
      <div id="provider">
        <h2 className="mb-4">{l10n.map.settings_provider}</h2>
        <form>
          <div className="form-group mb-4">
            <div className="custom-control custom-switch">
              <input className="custom-control-input" disabled={!this.state.gmail} type="checkbox" id="gmail_integration" name="gmail_integration" checked={this.state.gmail_integration} onChange={this.handleCheck} />
              <label className="custom-control-label" htmlFor="gmail_integration"><span>{l10n.map.provider_gmail_integration}</span></label>
            </div>
            {!this.state.gmail && (
              <Alert className="mt-2" type="warning" header={l10n.map.alert_header_warning}>
                <Trans id={l10n.map.provider_gmail_integration_warning} components={[
                  <strong key="0">{GMAIL_MATCH_PATTERN}</strong>,
                  <Link key="1" to="/settings/watchlist">{l10n.map.dashboard_link_manage_domains}</Link>
                ]} />
              </Alert>
            )}
            {this.state.gmail && (
              <Alert className="mt-2" type="info" header={l10n.map.alert_header_important}>
                {l10n.map.provider_gmail_integration_info} <a href="https://www.mailvelope.com/faq#gmail_permissions" target="_blank" rel="noopener noreferrer">{l10n.map.learn_more_link}</a>
              </Alert>
            )}
            <p className="lead mt-3">{l10n.map.provider_gmail_auth_table_title}</p>
            <div className="table-responsive">
              <table className="table table-hover table-custom mb-0">
                <thead>
                  <tr>
                    <th>{l10n.map.keygrid_user_email}</th>
                    <th>{l10n.map.provider_gmail_auth}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {this.state.gmail_authorized_emails.map((entry, index) =>
                    <tr key={index}>
                      <td>{entry.email}</td>
                      <td>{entry.scope.split(' ').map(val => this.getAuthText(val)).filter(val => val !== '').join(', ')}</td>
                      <td className="text-center">
                        <div className="actions">
                          <button type="button" onClick={e => { e.stopPropagation(); this.removeAuthorisation(entry.email); }} className="btn btn-secondary">{l10n.map.provider_gmail_auth_cancel_btn}</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="btn-bar">
            <button type="button" onClick={this.handleSave} className="btn btn-primary" disabled={!this.state.modified}>{l10n.map.form_save}</button>
            <button type="button" onClick={this.handleCancel} className="btn btn-secondary" disabled={!this.state.modified}>{l10n.map.form_cancel}</button>
          </div>
        </form>
        {this.authModal()}
      </div>
    );
  }
}

Provider.propTypes = {
  location: PropTypes.object,
  onSetNotification: PropTypes.func
};
