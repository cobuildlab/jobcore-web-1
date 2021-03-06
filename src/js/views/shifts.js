import React, { useContext, useState, useEffect } from "react";
import { Link } from 'react-router-dom';
import Flux from "@4geeksacademy/react-flux-dash";
import { store, create, searchMe, fetchAllMe } from '../actions.js';
import PropTypes from 'prop-types';
import _ from 'underscore';

import Select from 'react-select';

import DateTime from 'react-datetime';
import TimePicker from 'rc-time-picker';

import { Notify } from 'bc-react-notifier';
import queryString from 'query-string';
import { ShiftCard, Wizard, Theme, SearchCatalogSelect, Button, ApplicantCard, GenericCard, EmployeeExtendedCard, Avatar } from '../components/index';
import { DATETIME_FORMAT, TIME_FORMAT, NOW, TODAY, YESTERDAY } from '../components/utils.js';
import { validator, ValidationError } from '../utils/validation';
import { callback, hasTutorial } from '../utils/tutorial';
import { AddOrEditLocation } from '../views/locations.js';
import { ShiftInvite, Talent } from '../views/talents.js';

import moment from 'moment';
import { GET } from '../utils/api_wrapper';
const SHIFT_POSSIBLE_STATUS = ['UNDEFINED', 'DRAFT', 'OPEN', 'CANCELLED'];

//gets the querystring and creats a formData object to be used when opening the rightbar
export const getShiftInitialFilters = () => {
    return {};
};

export const Shift = (data) => {

    const _defaults = {
        position: '',
        maximum_allowed_employees: '1',
        application_restriction: 'ANYONE',
        minimum_hourly_rate: '8',
        starting_at: moment().add(15 - (moment().minute() % 15), "minutes"),
        ending_at: moment().add(15 - (moment().minute() % 15) + 120, "minutes"),
        employees: [],
        pending_invites: [],
        pending_jobcore_invites: [],
        candidates: [],
        allowed_from_list: [],
        allowedFavlists: [],
        allowedTalents: [],
        minimum_allowed_rating: '1',
        venue: '',
        status: 'UNDEFINED',
        withStatus: function (newStatus) {
            if (typeof newStatus === 'string') this.status = newStatus;
            else throw new Error('Invalid status ' + newStatus);

            return this;
        },
        serialize: function () {

            let newShift = {
                status: (this.status == 'UNDEFINED') ? 'DRAFT' : this.status,
                // starting_at: (moment.isMoment(this.starting_at)) ? this.starting_at.format(DATETIME_FORMAT) : this.starting_at,
                // ending_at: (moment.isMoment(this.ending_at)) ? this.ending_at.format(DATETIME_FORMAT) : this.ending_at,
                starting_at: moment(this.starting_at),
                ending_at: moment(this.ending_at),
                allowed_from_list: this.allowedFavlists.map(f => f.value),
                multiple_dates: Array.isArray(this.multiple_dates) && this.multiple_dates.length > 0 ? this.multiple_dates : undefined
            };

            // this is not ready yet
            delete newShift.required_badges;
            //this is a special property used on the form for creating an expried (past) shift and adding the employess right away
            if (Array.isArray(this.employeesToAdd)) newShift.employees = this.employeesToAdd.map(e => e.value || e.id);

            return Object.assign(this, newShift);
        },
        unserialize: function () {
            const dataType = typeof this.starting_at;
            //if its already serialized
            if ((typeof this.position == 'object') && ['number', 'string'].indexOf(dataType) == -1) return this;
            const newShift = {
                position: (typeof this.position != 'object') ? store.get('positions', this.position) : this.position,
                venue: (typeof this.venue != 'object') ? store.get('venues', this.venue) : this.venue,
                starting_at: (!moment.isMoment(this.starting_at)) ? moment(this.starting_at) : this.starting_at,
                ending_at: (!moment.isMoment(this.ending_at)) ? moment(this.ending_at) : this.ending_at,
                allowedFavlists: this.allowed_from_list.map(fav => {
                    const list = store.get('favlists', fav.id || fav);
                    return (list) ? { value: list.id, label: list.title, title: list.title} : null;
                }),
                expired: moment(this.ending_at).isBefore(NOW()),
                price: {
                    currency: 'usd',
                    currencySymbol: '$',
                    amount: this.minimum_hourly_rate,
                    timeframe: 'hr'
                }
            };
            return Object.assign(this, newShift);
        }

    };

    let _shift = Object.assign(_defaults, data);
    return {
        get: () => {
            return _shift;
        },
        validate: () => {
            const start = _shift.starting_at;
            const finish = _shift.ending_at;

            if (_shift.status == 'CANCELLED') return _shift;

            if (!validator.isInt(_shift.position.toString(), { min: 1 })) throw new ValidationError('The shift is missing a position');
            if (!validator.isInt(_shift.maximum_allowed_employees.toString(), { min: 1, max: 25 })) throw new ValidationError('The shift needs to employ at least 1 talent and no more than 25');
            if (!validator.isFloat(_shift.minimum_hourly_rate.toString(), { min: 7 })) throw new ValidationError('The minimum allowed hourly rate is $7');
            // if (!start.isValid() || start.isBefore(NOW())) throw new ValidationError('The shift date has to be greater than today');
            if (!finish.isValid() || finish.isBefore(start)) throw new ValidationError('The shift ending time has to be grater than the starting time');
            if (!validator.isInt(_shift.venue.toString(), { min: 1 })) throw new ValidationError('The shift is missing a venue');
            if (SHIFT_POSSIBLE_STATUS.indexOf(_shift.status) == -1) throw new Error('Invalid status "' + _shift.status + '" for shift');

            return _shift;
        },
        defaults: () => {
            return _defaults;
        },
        getFormData: () => {
            const _formShift = {
                id: _shift.id.toString(),
                pending_jobcore_invites: _shift.pending_jobcore_invites,
                application_restriction: _shift.application_restriction,
                pending_invites: (typeof _shift.pending_invites == 'undefined') ? [] : _shift.pending_invites,
                position: _shift.position.id.toString() || _shift.position.toString(),
                maximum_allowed_employees: _shift.maximum_allowed_employees.toString(),
                minimum_hourly_rate: _shift.minimum_hourly_rate.toString(),
                starting_at: _shift.starting_at,
                ending_at: _shift.ending_at,
                status: _shift.status,
                allowedFavlists: _shift.allowedFavlists,
                start_time: (moment.isMoment(_shift.starting_at)) ? _shift.starting_at : moment(_shift.starting_at + ' ' + _shift.starting_at).format("MM/DD/YYYY"),
                finish_time: (moment.isMoment(_shift.starting_at)) ? _shift.ending_at : moment(_shift.ending_at + ' ' + _shift.ending_at).format("MM/DD/YYYY"),
                minimum_allowed_rating: _shift.minimum_allowed_rating.toString(),
                venue: _shift.venue.id.toString() || _shift.venue.toString(),
                employees: _shift.employees
            };
            return _formShift;
        }
    };
};

export class ManageShifts extends Flux.DashView {

    constructor() {
        super();
        this.state = {
            shifts: [],
            showNextButton: true,
            offset: 10,
            runTutorial: hasTutorial(),
            steps: [
                {
                    target: '#shift-details-header',
                    content: 'Here you can see your entire list of shifts',
                    placement: 'right'
                },
                {
                    target: '#create_shift',
                    content: 'You can also create new shifts',
                    placement: 'left'
                },
                {
                    target: '#filter_shift',
                    content: 'Or filter them for better browsing',
                    placement: 'left'
                }
            ]
        };
    }

    componentDidMount() {
        let status = queryString.parse(window.location.search, { arrayFormat: 'index' });

        // fetch if not loaded already
        let shifts = store.getState('shifts');

        if(status.status){
            searchMe(`shifts`, `?envelope=true&limit=10&${status.status == "FILLED" ? "filled=true&upcoming=true&not_status=DRAFT" : "status=" + status.status}`).then(data => {
                const showNextButton = (data.next !== null);
                this.setState({ showNextButton });
            });
        }else{
            searchMe(`shifts`, `?envelope=true&limit=10`).then(data => {
                const showNextButton = (data.next !== null);
                this.setState({ showNextButton });
            }); 
        }
        this.subscribe(store, 'shifts', (shifts) => {
            this.filterShifts(shifts);
        });

        this.props.history.listen(() => {
            this.filterShifts();
        });
        this.setState({ runTutorial: true });

    }

    filterShifts(shifts = null) {
        let filters = this.getFilters();
        if (!shifts) shifts = store.getState('shifts');
        if (Array.isArray(shifts) && shifts.length > 0)
            this.setState({  shifts: shifts });
        else this.setState({ shifts: [] });
    }

    getFilters() {
        let filters = queryString.parse(window.location.search, { arrayFormat: 'index' });
        for (let f in filters) {
            switch (f) {
                case "status":
                    filters[f] = {
                        value: filters[f],
                        matches: (shift) => {
                            let values = filters.status.value.split(',');
                            if (values.length == 1) {
                                if (values.includes("OPEN")) {
                                    if (
                                        moment(shift.ending_at).isBefore(NOW()) || //has passed
                                        (shift.maximum_allowed_employees <= shift.employees.length) //or its filled
                                    ) {
                                        return false;
                                    }
                                } else if (values.includes("FILLED")) {
                                    if (shift.maximum_allowed_employees > shift.employees.length) return false;
                                } else if (values.includes("EXPIRED")) {
                                    if (moment(shift.ending_at).isAfter(NOW())) return false;
                                    else values.push('OPEN');
                                }
                            }
                            return values.includes(shift.status);
                        }
                    };
                    break;
                case "position":
                    filters[f] = {
                        value: filters[f],
                        matches: (shift) => {
                            if (!filters.position.value) return true;
                            if (isNaN(filters.position.value)) return true;
                            return shift.position.id == filters.position.value;
                        }
                    };
                    break;
                case "talent":
                    filters[f] = {
                        value: filters[f],
                        matches: (shift) => {
                            const emp = shift.employees.find(e => e.id == filters.talent.value);
                            return emp;
                        }
                    };
                    break;
                case "venue":
                    filters[f] = {
                        value: filters[f],
                        matches: (shift) => {
                            if (!filters.venue.value) return true;
                            if (isNaN(filters.venue.value)) return true;
                            return shift.venue.id == filters.venue.value;
                        }
                    };
                    break;
                case "minimum_hourly_rate":
                    filters[f] = {
                        value: filters[f],
                        matches: (shift) => {
                            if (!filters.minimum_hourly_rate.value) return true;
                            if (isNaN(filters.minimum_hourly_rate.value)) return true;
                            return parseInt(shift.minimum_hourly_rate, 10) >= filters.minimum_hourly_rate.value;
                        }
                    };
                    break;
                case "date":
                    filters[f] = {
                        value: filters[f],
                        matches: (shift) => {
                            const fdate = moment(filters.date.value);
                            return shift.starting_at.diff(fdate, 'days') == 0;
                        }
                    };
                    break;
                default: throw new Error('Invalid filter');
            }
        }
        return filters;
    }

    render() {
        let status = queryString.parse(window.location.search, { arrayFormat: 'index' });
        console.log('status', status);
        const groupedShifts = _.groupBy(this.state.shifts, (s) => moment(s.starting_at).format('MMMM YYYY'));
        const shiftsHTML = [];

        for (let date in groupedShifts) {
            shiftsHTML.push(<div key={date} className="date-group">
                <p className="date-group-label">{date}</p>
                <div>
                    {groupedShifts[date].map((s, i) => (<ShiftCard key={i} shift={s} showStatus={true} />))}
                </div>
            </div>);

        }
        return (<div className="p-1 listcontents">
            <Wizard continuous
                steps={this.state.steps}
                run={this.state.runTutorial}
                callback={callback}
            />
            <h1 className="float-left"><span id="shift-details-header">Shift Details</span></h1>
            {shiftsHTML.length == 0 && <div className="mt-5">No shifts have been found</div>}
            {shiftsHTML}
            {this.state.showNextButton && shiftsHTML.length != 0 ? (
                <div className="row text-center w-100 mt-3">
                    <div className="col">
                        <Button onClick={() => {
                            const PAGINATION_LENGTH = 10;
                            const NOT_FILLED_SHIFT = `&status=${status.status}`;
                            const FILLED_SHIFT = '&filled=true&upcoming=true&not_status=DRAFT&envelope=true';
                            if(status.status){
                                searchMe(`shifts`, `?envelope=true&limit=10&offset=${this.state.offset + PAGINATION_LENGTH}${status.status == "FILLED" ? FILLED_SHIFT:NOT_FILLED_SHIFT}`, this.state.shifts)
                                    .then((newShifts) => {
                                        const showNextButton = (newShifts.next !== null);
                                        this.setState({ shifts: newShifts, offset: this.state.offset + PAGINATION_LENGTH, showNextButton });
                                    });
                            }else{
                                searchMe(`shifts`, `?envelope=true&limit=10&offset=${this.state.offset + PAGINATION_LENGTH}`, this.state.shifts)
                                .then((newShifts) => {
                                    const showNextButton = (newShifts.next !== null);
                                    this.setState({ shifts: newShifts, offset: this.state.offset + PAGINATION_LENGTH, showNextButton });
                                });
                            }
                        }}>Load More</Button>
                    </div>
                </div>
            ) : null}
        </div>);
    }
}


/**
 * FilterShifts
 */
export const FilterShifts = ({ onSave, onCancel, onChange, catalog }) => {
    const [position, setPosition] = useState("");
    const [date, setDate] = useState("");
    const [price, setPrice] = useState("");
    const [employees, setEmployees] = useState("");
    const [location, setLocation] = useState("");
    const [status, setStatus] = useState("");
    console.log(employees);
    useEffect(() => {
        const venues = store.getState('venues');
        if (!venues) fetchAllMe(['venues']);
    }, []);
 
return(<form>
    <div className="row">
        <div className="col">
            <label>Looking for</label>
            <Select
                onChange={(selection) => setPosition(selection.value)}
                options={catalog.positions}
            />
        </div>
    </div>
    <div className="row">
        <div className="col-8">
            <label>Date</label>
            <DateTime
                timeFormat={false}
                className="w-100"
                closeOnSelect={true}
                renderInput={(properties) => {
                    const { value, ...rest } = properties;
                    return <input value={value.match(/\d{2}\/\d{2}\/\d{4}/gm)} {...rest} />;
                }}
                onChange={(value) =>  setDate(value.format("YYYY-MM-DD"))
                }
            />
        </div>
        <div className="col-4">
            <label>Price / hour</label>
            <input type="number" className="form-control" onChange={(e) =>  setPrice(e.target.value) } />
        </div>
    </div>
    <div className="row">
        <div className="col">
            <label>Location</label>
            <Select
                onChange={(selection) => setLocation(selection.value.toString())}
                options={catalog.venues}
            />
        </div>
    </div>
    <div className="row">
        <div className="col">
            <label>Worked by a talent:</label>
            <SearchCatalogSelect
                isMulti={true}
                value={employees}
                onChange={(selections) => {
                   setEmployees(selections);
                }}
                searchFunction={(search) => new Promise((resolve, reject) =>
                    GET('catalog/employees?full_name=' + search)
                        .then(talents => resolve([
                            { label: `${(talents.length == 0) ? 'No one found: ' : ''}`, value: 'invite_talent_to_jobcore' }
                        ].concat(talents)))
                        .catch(error => reject(error))
                )}
            />
        </div>
    </div>
    <div className="row">
        <div className="col">
            <label>Status</label>
            <Select
                onChange={(selection) => setStatus(selection.value.toString())}
                options={catalog.shiftStatus}
            />
        </div>
    </div>
    <div className="btn-bar">
        <button type="button" className="btn btn-primary" onClick={() => {
            const employeesList = employees != "" ? `&employee=${employees.map(e => e.value)}` : '';
            searchMe(`shifts`, `?${status == "FILLED" ? "filled=true&upcoming=true&not_status=DRAFT" : "status=" + status}&envelope=true&limit=10&position=${position}&venue=${location}&start=${date}${employeesList}`);
        }}>Apply Filters</button>
        <button type="button" className="btn btn-secondary" onClick={() => onSave(false)}>Clear Filters</button>
    </div>
</form>);
};
FilterShifts.propTypes = {
    onSave: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    formData: PropTypes.object, //contains the data needed for the form to load
    onChange: PropTypes.func.isRequired,
    catalog: PropTypes.object //contains the data needed for the form to load
};

/**
 * ShiftApplicants
 */
export const ShiftApplicants = (props) => {
    const { onCancel, onSave, catalog } = props;
    console.log(props);
    return (<Theme.Consumer>
        {({ bar }) => (<div className="sidebar-applicants">
            {catalog.shift.expired ?
                <div className="alert alert-warning">This shift has already expired</div>
                :
                <div className="top-bar">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => bar.show({
                        slug: "search_talent_and_invite_to_shift",
                        data: { shifts: [catalog.shift], employees: [] },
                        allowLevels: true
                    })}
                    >
                        invite
                    </button>
                </div>
            }
            <h3>Shift applicants:</h3>
            <ul style={{ overflowY: "auto", maxHeight: "75vh" }}>
                {
                    catalog.applicants.length > 0 ?
                        catalog.applicants.map((tal, i) => (
                            <EmployeeExtendedCard
                                key={i}
                                employee={tal}
                                hover={false}
                                showFavlist={false}
                                onClick={() => bar.show({ slug: "show_single_talent", data: Talent(tal, i).defaults().unserialize(), allowLevels: true })}
                            >
                                {!catalog.shift.expired &&
                                    <Button className="mt-0" icon="check" label="Delete" onClick={() => onSave({
                                        executed_action: 'accept_applicant',
                                        applicant: tal,
                                        shift: catalog.shift
                                    })} />
                                }
                                {!catalog.shift.expired &&
                                    <Button className="mt-0" icon="times" label="Delete" onClick={() => onSave({
                                        executed_action: 'reject_applicant',
                                        applicant: tal,
                                        shift: catalog.shift
                                    })} />
                                }
                            </EmployeeExtendedCard>)
                        )
                        :
                        <li>No applicants were found for this shift, <span className="anchor"
                            onClick={() => bar.show({ slug: "search_talent_and_invite_to_shift",data: { shifts: [catalog.shift], employees: [] },  allowLevels: true })}
                        >invite more talents</span> or  <span className="anchor"
                            onClick={() => bar.show({ slug: "review_shift_invites", allowLevels: true, data: catalog.shift })}
                        >review previous invites</span></li>
                }
            </ul>
        </div>)}
    </Theme.Consumer>);
};
ShiftApplicants.propTypes = {
    onSave: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    catalog: PropTypes.object, //contains the data needed for the form to load
    context: PropTypes.object //contact any additional data for context purposes
};

/**
 * ShiftApplicants
 */
export const ShiftEmployees = (props) => {
    const { onCancel, onSave, catalog } = props;
    return (<Theme.Consumer>
        {({ bar }) => (<div className="sidebar-applicants">
            {catalog.shift.expired ?
                <div className="alert alert-warning">This shift has already expired</div>
                :
                <div className="top-bar">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => bar.show({
                        slug: "search_talent_and_invite_to_shift",
                        data: { shifts: [catalog.shift] },
                        allowLevels: true
                    })}>
                        invite
                    </button>
                </div>
            }
            <h3>Shift Scheduled Employees:</h3>
            {
                catalog.shift.employees.length > 0 ?
                    catalog.shift.employees.map((emp, i) => (
                        <EmployeeExtendedCard
                            key={i}
                            employee={emp}
                            hover={false}
                            showFavlist={false}
                            onClick={() => bar.show({ slug: "show_single_talent", data: Talent(emp).defaults().unserialize(), allowLevels: true })}
                        >
                            <Button
                                className="mt-0 text-white" icon="clock" label="Clockin log"
                                onClick={() => bar.show({ slug: "talent_shift_clockins", data: { employee: emp, shift: catalog.shift }, allowLevels: true })}
                            />

                            {!catalog.shift.expired && <Button className="mt-0 text-danger" icon="trash" label="Delete" onClick={() => {
                                const noti = Notify.info("Are you sure? The Talent will be kicked out of this shift", (answer) => {
                                    if (answer) onSave({
                                        executed_action: 'delete_shift_employee',
                                        employee: emp,
                                        shift: catalog.shift
                                    });
                                    noti.remove();
                                });
                            }} />
                            }
                        </EmployeeExtendedCard>)
                    )
                    : catalog.shift.expired ?
                        <p>No talents every worked on this shift</p>
                        :
                        <p>No talents have been accepted for this shift yet, <span className="anchor"
                            onClick={() => bar.show({ slug: "search_talent_and_invite_to_shift", allowLevels: true })}
                        >invite more talents</span> or  <span className="anchor"
                            onClick={() => bar.show({ slug: "review_shift_invites", allowLevels: true, data: [catalog.shift] })}
                        >review previous invites</span></p>
            }
        </div>)}
    </Theme.Consumer>);
};
ShiftEmployees.propTypes = {
    onSave: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    catalog: PropTypes.object, //contains the data needed for the form to load
    context: PropTypes.object //contact any additional data for context purposes
};

/**
 * ShiftApplicants
 */
export const ShiftInvites = ({ onCancel, onSave, formData }) => {
    const { bar } = useContext(Theme.Context);

    const status = {
        "PENDING": "waiting for reponse",
        "APPLIED": "the talent applied",
        "REJECTED": "the talent reject it"
    };
    //formData.shift.maximum_allowed_employees
    //formData.shift.status != "OPEN"
    const htmlInvites = formData.invites.map((invite, i) => (
        <GenericCard
            key={i}
            className="pr-2"
            onClick={() => bar.show({ slug: "show_single_talent", data: invite.employee, allowLevels: true })}
        >
            <Avatar url={invite.employee.user.profile.picture} />
            <p><b>{invite.employee.user.first_name + ' ' + invite.employee.user.last_name}</b></p>
            <p className="mr-2 my-0">Sent {moment(invite.created_at).fromNow()} and <span className="badge">{status[invite.status]}</span></p>
        </GenericCard>)
    );
    return (<div className="sidebar-applicants">
        <h3>Already invited to this shift:</h3>
        {formData.shift.status != "OPEN" && <div className="alert alert-warning">This shift is not accepting any more candidates, this invites will be erased soon.</div>}
        {formData.shift.maximum_allowed_employees <= formData.shift.employees.length && <div className="alert alert-warning">This shift is full (filled), this invites will be erased soon.</div>}
        {
            htmlInvites.length > 0 ?
                htmlInvites
                :
                <p>No invites have been sent</p>
        }
    </div>);
};
ShiftInvites.propTypes = {
    onSave: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    formData: PropTypes.object, //contains the data needed for the form to load
    context: PropTypes.object //contact any additional data for context purposes
};

/**
 * EditOrAddShift
 */
const EditOrAddShift = ({ onSave, onCancel, onChange, catalog, formData, error, bar, oldShift }) => {

    useEffect(() => {
        const venues = store.getState('venues');
        const favlists = store.getState('favlists');
        if (!venues || !favlists) fetchAllMe(['venues', 'favlists']);
    }, []);
    const expired = moment(formData.starting_at).isBefore(NOW()) || moment(formData.ending_at).isBefore(NOW());
    if(catalog.positions.find((pos) => pos.value == formData.position.id || pos.value == formData.position))formData['position'] = catalog.positions.find((pos) => pos.value == formData.position.id || pos.value == formData.position).value.toString();
    if(catalog.positions.find((pos) => pos.value == formData.venue.id || pos.value == formData.venue))formData['venue'] = catalog.positions.find((pos) => pos.value == formData.venue.id || pos.value == formData.venue).value.toString();
    if(formData.employer && isNaN(formData.employer )) formData.employer = formData.employer.id;
    if(!formData.shift && !isNaN(formData.id)) formData.shift = formData.id;
    if(formData.required_badges) delete formData.required_badges;
    return (
        <form>
            <div className="row">
                <div className="col-12">
                    {formData.hide_warnings === true ? null : (formData.status == 'DRAFT' && !error) ?
                        <div className="alert alert-warning d-inline"><i className="fas fa-exclamation-triangle"></i> This shift is a draft</div>
                        : (formData.status != 'UNDEFINED' && !error) ?
                            <div className="alert alert-success">This shift is published, therefore <strong>it needs to be unpublished</strong> before it can be updated</div>
                            : ''
                    }
                </div>
            </div>
            <div className="row">
                <div className="col-12">
                    <label>Looking for</label>
                    <Select
                        placeholder="Select a position"
                        value={catalog.positions.find((pos) => pos.value == formData.position.id || pos.value == formData.position)}
                        onChange={(selection) => onChange({ position: selection.value.toString(), has_sensitive_updates: true })}
                        options={catalog.positions}
                    />
                </div>
            </div>
            <div className="row">
                <div className="col-6">
                    <label>How many?</label>
                    <input type="number" className="form-control"
                        value={formData.maximum_allowed_employees}
                        onChange={(e) => {
                            if (parseInt(e.target.value, 10) > 0) {
                                if (oldShift && oldShift.employees.length > parseInt(e.target.value, 10)) Notify.error(`${oldShift.employees.length} talents are scheduled to work on this shift already, delete scheduled employees first.`);
                                else onChange({ maximum_allowed_employees: e.target.value });
                            }
                        }}
                    />
                </div>
                <div className="col-6">
                    <label>Price / hour</label>
                    <input type="number" className="form-control"
                        value={formData.minimum_hourly_rate}
                        onChange={(e) => onChange({
                            minimum_hourly_rate: e.target.value,
                            has_sensitive_updates: true
                        })}
                    />
                </div>
            </div>
            <div className="row">
                <div className="col-12">
                    <label className="mb-1">Dates</label>
                    {formData.multiple_dates && <p className="mb-1 mt-0">
                        {formData.multiple_dates.map((d, i) => (
                            <span key={i} className="badge">{d.starting_at.format('MM-DD-YYYY')}
                                <i
                                    className="fas fa-trash-alt ml-1 pointer"
                                    onClick={() => onChange({
                                        multiple_dates: !formData.multiple_dates ? [] : formData.multiple_dates.filter(dt => !dt.starting_at.isSame(d.starting_at)),
                                        has_sensitive_updates: true
                                    })}
                                />
                            </span>
                        ))}
                    </p>}
                    <div className="input-group">
                        <DateTime
                            timeFormat={false}
                            className="shiftdate-picker"
                            closeOnSelect={true}
                            value={formData.starting_at}
                            isValidDate={(current) => {
                                return formData.multiple_dates !== undefined && formData.multiple_dates.length > 0 ? current.isAfter(YESTERDAY) : true;
                            }}
                            renderInput={(properties) => {
                                const { value, ...rest } = properties;
                                return <input value={value.match(/\d{2}\/\d{2}\/\d{4}/gm)} {...rest} />;
                            }}
                            onChange={(value) => {


                                const getRealDate = (start, end) => {
                                    if (typeof start == 'string') value = moment(start);

                                    const starting = moment(start.format("MM-DD-YYYY") + " " + start.format("hh:mm a"), "MM-DD-YYYY hh:mm a");

                                    var ending = moment(start.format("MM-DD-YYYY") + " " + end.format("hh:mm a"), "MM-DD-YYYY hh:mm a");
                                    if (typeof starting !== 'undefined' && starting.isValid()) {
                                        if (ending.isBefore(starting)) {
                                            ending = ending.add(1, 'days');
                                        }

                                        return { starting_at: starting, ending_at: ending };
                                    }
                                    return null;
                                };

                                const mainDate = getRealDate(value, formData.ending_at);

                                const multipleDates = !Array.isArray(formData.multiple_dates) ? [] : formData.multiple_dates.map(d => getRealDate(d.starting_at, d.ending_at));
                                onChange({ ...mainDate, multiple_dates: multipleDates, has_sensitive_updates: true });


                            }}


                        />
                        <div className="input-group-append" onClick={() => {
                            if (expired) Notify.error("Shifts with and expired starting or ending times cannot have multiple dates or be recurrent");
                            else onChange({
                                multiple_dates: !formData.multiple_dates ?
                                    [{ starting_at: formData.starting_at, ending_at: formData.ending_at }]
                                    :
                                    formData.multiple_dates.filter(dt => !dt.starting_at.isSame(formData.starting_at)).concat(
                                        { starting_at: formData.starting_at, ending_at: formData.ending_at }
                                    ),
                                has_sensitive_updates: true
                            });
                        }}>
                            <span className="input-group-text pointer">More <i className="fas fa-plus ml-1"></i></span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="row">
                <div className="col-6">
                    <label>From</label>
                    <DateTime
                        dateFormat={false}
                        timeFormat={DATETIME_FORMAT}
                        closeOnTab={true}
                        timeConstraints={{ minutes: { step: 15 } }}
                        value={formData.starting_at}
                        renderInput={(properties) => {
                            const { value, ...rest } = properties;
                            return <input value={value.match(/\d{1,2}:\d{1,2}\s?[ap]m/gm)} {...rest} />;
                        }}
                        onChange={(value) => {
                            if (typeof value == 'string') value = moment(value);

                            const getRealDate = (start, end) => {
                                const starting = moment(start.format("MM-DD-YYYY") + " " + value.format("hh:mm a"), "MM-DD-YYYY hh:mm a");
                                var ending = moment(end);
                                if (typeof starting !== 'undefined' && starting.isValid()) {
                                    if (ending.isBefore(starting)) {
                                        ending = ending.add(1, 'days');
                                    }

                                    return { starting_at: starting, ending_at: ending };
                                }
                                return null;
                            };

                            const mainDate = getRealDate(formData.starting_at, formData.ending_at);
                            const multipleDates = !Array.isArray(formData.multiple_dates) ? [] : formData.multiple_dates.map(d => getRealDate(d.starting_at, d.ending_at));
                            onChange({ ...mainDate, multiple_dates: multipleDates, has_sensitive_updates: true });


                        }}
                    />
                </div>
                <div className="col-6">
                    <label>To {(formData.ending_at.isBefore(formData.starting_at)) && "(next day)"}</label>
                    <DateTime
                        className="picker-left"
                        dateFormat={false}
                        timeFormat={DATETIME_FORMAT}
                        timeConstraints={{ minutes: { step: 15 } }}
                        value={formData.ending_at}
                        renderInput={(properties) => {
                            const { value, ...rest } = properties;
                            return <input value={value.match(/\d{1,2}:\d{1,2}\s?[ap]m/gm)} {...rest} />;
                        }}
                        onChange={(value) => {
                            if (typeof value == 'string') value = moment(value);

                            const getRealDate = (start, end) => {

                                const starting = start;
                                var ending = moment(start.format("MM-DD-YYYY") + " " + value.format("hh:mm a"), "MM-DD-YYYY hh:mm a");

                                if (typeof starting !== 'undefined' && starting.isValid()) {
                                    if (ending.isBefore(starting)) {
                                        ending = ending.add(1, 'days');
                                    }

                                    return { starting_at: starting, ending_at: ending };
                                }
                                return null;
                            };

                            const mainDate = getRealDate(formData.starting_at, formData.ending_at);
                            const multipleDates = !Array.isArray(formData.multiple_dates) ? [] : formData.multiple_dates.map(d => getRealDate(d.starting_at, d.ending_at));
                            onChange({ ...mainDate, multiple_dates: multipleDates, has_sensitive_updates: true });

                        }}
                    />
                </div>
            </div>
            <div className="row">
                <div className="col-12">
                    <label>Location</label>
                    <Select
                        value={catalog.venues.find((ven) => ven.value == formData.venue.id || ven.value == formData.venue)}
                        options={[{ label: "Add a location", value: 'new_venue', component: AddOrEditLocation }].concat(catalog.venues)}
                        onChange={(selection) => {
                            if (selection.value == 'new_venue') bar.show({ slug: "create_location", allowLevels: true });
                            else onChange({ venue: selection.value.toString(), has_sensitive_updates: true });
                        }}
                    />
                </div>
            </div>
            <div className="row mt-3">
                <div className="col-12">
                    <h4>Who can apply to this shift?</h4>
                </div>
            </div>
            <div className="row">
                <div className="col-12">
                    {expired ?
                        <div className="alert alert-warning">This shift has an expired date, therefore you cannot invite anyone but you can still use it for payroll purposes.</div>
                        :
                        <Select
                            value={catalog.applicationRestrictions.find((a) => a.value == formData.application_restriction)}
                            onChange={(selection) => onChange({ application_restriction: selection.value.toString() })}
                            options={catalog.applicationRestrictions}
                        />
                    }
                </div>
            </div>
            {
                (!expired && formData.application_restriction == "FAVORITES") ?
                    <div className="row">
                        <div className="col-12">
                            <label>From these favorite lists</label>
                            <Select isMulti
                                value={formData.allowedFavlists}
                                onChange={(opt) => onChange({ allowedFavlists: opt })}
                                options={catalog.favlists}
                            >
                            </Select>
                        </div>
                    </div>
                    : (!expired && formData.application_restriction == "ANYONE") ?
                        <div className="row mt-3">
                            <div className="col-5">
                                <label className="mt-2">Minimum rating</label>
                            </div>
                            <div className="col-7">
                                <Select
                                    value={catalog.stars.find((s) => s.value == formData.minimum_allowed_rating)}
                                    onChange={(selection) => onChange({ minimum_allowed_rating: selection.value })}
                                    options={catalog.stars}
                                />
                            </div>
                        </div>
                        : !expired &&
                        <div className="row">
                            <div className="col-12">
                                <label>Search people in JobCore:</label>
                                <SearchCatalogSelect
                                    isMulti={true}
                                    value={formData.pending_invites}
                                    onChange={(selections) => {
                                        const invite = selections.find(opt => opt.value == 'invite_talent_to_jobcore');
                                        if (invite) bar.show({
                                            allowLevels: true,
                                            slug: "invite_talent_to_jobcore",
                                            onSave: (emp) => onChange({ pending_jobcore_invites: formData.pending_jobcore_invites.concat(emp) })
                                        });
                                        else onChange({ pending_invites: selections });
                                    }}
                                    searchFunction={(search) => new Promise((resolve, reject) =>
                                        GET('catalog/employees?full_name=' + search)
                                            .then(talents => resolve([
                                                { label: `${(talents.length == 0) ? 'No one found: ' : ''}Invite "${search}" to jobcore`, value: 'invite_talent_to_jobcore' }
                                            ].concat(talents)))
                                            .catch(error => reject(error))
                                    )}
                                />
                            </div>
                        </div>
            }
            {(formData.pending_jobcore_invites.length > 0) ?
                <div className="row">
                    <div className="col-12">
                        <p className="m-0 p-0">The following people will be invited to this shift after they accept your invitation to jobcore:</p>
                        {formData.pending_jobcore_invites.map((emp, i) => (
                            <span key={i} className="badge">{emp.first_name} {emp.last_name} <i className="fas fa-trash-alt"></i></span>
                        ))}
                    </div>
                </div> : ''
            }
            <div className="btn-bar">
                {(formData.status == 'DRAFT' || formData.status == 'UNDEFINED') ? // create shift
                    <button type="button" className="btn btn-primary" onClick={() => onSave({
                        executed_action: isNaN(formData.id) ? 'create_shift' : 'update_shift',
                        status: 'DRAFT'
                    })}>Save as draft</button> : ''
                }
                {(formData.status == 'DRAFT') ?
                    <button type="button" className="btn btn-success" onClick={() => {
                        if (!formData.has_sensitive_updates && !isNaN(formData.id)) onSave({ executed_action: 'update_shift', status: 'OPEN' });
                        else {
                            const noti = Notify.info("Are you sure? All talents will have to apply again the shift because the information was updated.", (answer) => {
                                if (answer) onSave({
                                    executed_action: isNaN(formData.id) ? 'create_shift' : 'update_shift',
                                    status: 'OPEN'
                                });
                                noti.remove();
                            });
                        }
                    }}>Publish</button>
                    : (formData.status != 'UNDEFINED') ?
                        <button type="button" className="btn btn-primary" onClick={() => {
                            const noti = Notify.info("Are you sure you want to unpublish this shift?", (answer) => {
                                if (answer) onSave({ executed_action: 'update_shift', status: 'DRAFT' });
                                noti.remove();
                            }, 9999999999999);
                        }}>Unpublish shift</button>
                        :
                        <button type="button" className="btn btn-success" onClick={() => onSave({
                            executed_action: isNaN(formData.id) ? 'create_shift' : 'update_shift',
                            status: 'OPEN'
                        })}>Save and publish</button>
                }
                {(formData.status != 'UNDEFINED') ?
                    <button type="button" className="btn btn-danger" onClick={() => {
                        const noti = Notify.info("Are you sure you want to cancel this shift?", (answer) => {
                            if (answer) onSave({ executed_action: 'update_shift', status: 'CANCELLED' });
                            noti.remove();
                        });
                    }}>Delete</button> : ''
                }
            </div>
        </form>
    );
};
EditOrAddShift.propTypes = {
    error: PropTypes.string,
    oldShift: PropTypes.object,
    bar: PropTypes.object,
    onSave: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    onChange: PropTypes.func.isRequired,
    formData: PropTypes.object,
    catalog: PropTypes.object //contains the data needed for the form to load
};
EditOrAddShift.defaultProps = {
    oldShift: null
};

/**
 * ShiftDetails
 */
export const ShiftDetails = (props) => {
    const creationMode = isNaN(props.formData.id);
    // const shift = !props.catalog.shifts ? null : props.catalog.shifts.find(s => s.id == props.formData.id);
    const shift = props.formData;
    if (!creationMode && (!shift || typeof shift === 'undefined')) return <div>Loading shift...</div>;
    return (<Theme.Consumer>
        {({ bar }) => (
            <div>
                {(creationMode) ?
                    <EditOrAddShift bar={bar} {...props} /> :
                    <div>
                        {!shift.expired ?
                            <div className="top-bar">
                                <Button icon="pencil" color="primary" size="small" rounded={true}
                                    note="Edit shift" notePosition="left"
                                    onClick={() => props.onChange({ status: 'DRAFT', hide_warnings: true })}
                                />
                                {['OPEN', 'FILLED'].includes(shift.status) &&
                                    <Button
                                        icon="candidates" color="primary" size="small" rounded={true}
                                        onClick={() => bar.show({ slug: "show_shift_applications", data: shift, title: "Shift Applicants", allowLevels: true })}
                                        note={shift.candidates.length > 0 ? "There shift has applications that have not been reviewed" : "Shift Applicants"}
                                        withAlert={shift.candidates.length > 0}
                                        notePosition="left"
                                    />
                                }

                                <Button icon="user_check" color="primary" notePosition="left" note="Shift accepted employees" size="small" rounded={true}
                                    onClick={() => bar.show({ slug: "show_shift_employees", data: shift, title: "Shift Employees", allowLevels: true })} />
                            </div>
                            :
                            <div className="top-bar">
                                <Button icon="user_check" color="primary" notePosition="left" size="small" rounded={true} note="Shift accepted employees"
                                    onClick={() => bar.show({ slug: "show_shift_employees", data: shift, title: "Shift Employees", allowLevels: true })} />
                                <Button icon="dollar" color="primary" notePosition="left" size="small" rounded={true}
                                    note={shift.status !== 'OPEN' ? 'Shift Payroll' : <span>This shift is expired and the payroll has not been processed</span>}
                                    withAlert={shift.status !== 'OPEN'}
                                    onClick={() => bar.show({ slug: "select_timesheet", data: shift, allowLevels: true })} />
                            </div>
                        }
                        {props.formData.status === 'DRAFT' ? <EditOrAddShift bar={bar} {...props} oldShift={shift} /> : <ShowShift bar={bar} shift={shift} />}

                        {moment(props.formData.ending_at).isBefore(NOW()) &&
                            <div className="row text-center mt-4">
                                <div className="col">
                                    <Button color="primary" onClick={() => bar.show({ slug: "show_employees_rating", data: shift, allowLevels: true })}>Rate Employees</Button>
                                </div>
                            </div>
                        }


                    </div>
                }
            </div>
        )}
    </Theme.Consumer>);
};
ShiftDetails.propTypes = {
    error: PropTypes.string,
    onSave: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    onChange: PropTypes.func.isRequired,
    formData: PropTypes.object,
    shift: PropTypes.object,
    catalog: PropTypes.object //contains the data needed for the form to load
};

const ShowShift = ({ shift, bar }) => {
    const totalCandidates = (Array.isArray(shift.candidates)) ? shift.candidates.length : 0;
    const totalEmployees = (Array.isArray(shift.employees)) ? shift.employees.length : 0;
    const openVacancys = shift.maximum_allowed_employees - totalEmployees;
    const startDate = shift.starting_at.format('ll');
    const startTime = shift.starting_at.format('LT');
    const endTime = shift.ending_at.format('LT');
    return (<div className="shift-details">
        <h3>{"Shift details"}</h3>
        {
            (shift.status == 'DRAFT') ?
                <span href="#" className="badge badge-secondary">draft</span> :
                (openVacancys == 0) ?
                    <span href="#" className="badge">filled</span> :
                    <span href="#" className="badge badge-danger">{totalCandidates}/{openVacancys}</span>
        }
        <a href="#" className="shift-position">{shift.position.title}</a> @
        <a href="#" className="shift-location"> {shift.venue.title}</a>
        <span className="shift-date"> {startDate} from {startTime} to {endTime} </span>
        {
            (typeof shift.price == 'string') ?
                <span className="shift-price"> ${shift.price}</span>
                :
                <span className="shift-price"> {shift.price.currencySymbol}{shift.price.amount}</span>
        }
        <hr/>
        <div> 
            <ShiftEmployees catalog={{shift: shift}}/>
        </div>
        <hr/>
        <ShiftApplicants catalog={{shift: shift, applicants: []}}/>
    </div>);
};
ShowShift.propTypes = {
    shift: PropTypes.object.isRequired,
    bar: PropTypes.object.isRequired
};
ShowShift.defaultProps = {
    shift: null,
    bar: null
};


/**
 * RateShift
 */
export const RateShift = () => (<div className="p-5 listcontents">
    <div className="row">
        <div className="col-12">
            <h4>Venue name</h4>
        </div>
    </div>
</div>);
RateShift.propTypes = {
};

/**
 * RateShift
 */
export const ShiftTalentClockins = ({ formData, onChange, onSave }) => {
    const { employee, clockins, shift } = formData;
    const { bar } = useContext(Theme.Context);
    const lastClockin = clockins.length === 0 ? null : moment.isMoment(clockins[clockins.length - 1].ended_at) ? clockins[clockins.length - 1].ended_at : moment(clockins[clockins.length - 1].ended_at);

    return (<div className="">
        <div className="row">
            <div className="col-12">
                {/*<div className="top-bar">
                    <Button size="small" color="primary" rounded={true} className="mr-2"
                        onClick={() => onChange({ new_clocking: { started_at: null, ended_at: null, shift: shift.id } })}
                    >add</Button>
                </div>*/}
                <h3>Clockins</h3>
                {clockins.length == 0 && <p>{employee.user.first_name} {employee.user.last_name} has not clocked in to this shift yet</p>}
                {(clockins.length > 0 || formData.new_clocking) &&
                    <div className="row px-3 text-center">
                        <div className="col">In</div>
                        <div className="col">Out</div>
                    </div>
                }
                {clockins.map(c => {
                    let started_at = moment.isMoment(c.started_at) ? c.started_at : moment(c.started_at);
                    let ended_at = moment.isMoment(c.ended_at) ? c.ended_at : moment(c.ended_at);
                    return <div key={c.id} className="row px-3 text-center">
                        <div className="col">{started_at.format('LT')}</div>
                        <div className="col">{ended_at.isValid(c.ended_at) ? ended_at.format('LT') : <span className="badge badge-secondary">Still Working</span>}</div>
                    </div>;
                })
                }
                {formData.new_clocking &&
                    <div className="row px-3 text-center">
                        <div className="col-6">
                            <TimePicker
                                showSecond={false}
                                defaultValue={lastClockin ? lastClockin : null}
                                format={TIME_FORMAT}
                                onChange={(value) => onChange({ new_clockin: { ...formData.new_clockin, started_at: value } })}
                                value={formData.new_clocking.started_at}
                                use12Hours
                                inputReadOnly
                            />
                        </div>
                        <div className="col-6">
                            <TimePicker
                                showSecond={false}
                                defaultValue={lastClockin ? lastClockin : null}
                                format={TIME_FORMAT}
                                onChange={(value) => onChange({ new_clockin: { ...formData.new_clockin, ended_at: value } })}
                                value={formData.new_clocking.ended_at}
                                use12Hours
                                inputReadOnly
                            />
                        </div>
                        <div className="col-6 mt-2">
                            <Button color="primary" className="w-100" onClick={() => onSave({ executed_action: 'add_clockin', clockin: formData.new_clocking })}>Save</Button>
                        </div>
                        <div className="col-6 mt-2">
                            <Button color="secondary" className="w-100" onClick={() => onChange({ formData: { ...formData, new_clockin: null } })}>Cancel</Button>
                        </div>
                    </div>
                }
            </div>
        </div>
    </div>);
};
ShiftTalentClockins.propTypes = {
    formData: PropTypes.object.isRequired,
    catalog: PropTypes.object.isRequired,
    onChange: PropTypes.func,
    onSave: PropTypes.func,
    history: PropTypes.object.isRequired
};